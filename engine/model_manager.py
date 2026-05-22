"""
Model Manager for ScreenMind
Handles llama-server process lifecycle, GGUF model downloads, and model switching.
"""

import os
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Optional, Callable

from config import settings


# Available models with HuggingFace download info
AVAILABLE_MODELS = [
    {
        "key": "gemma-4-e2b",
        "name": "Gemma 4 E2B",
        "size": "2B",
        "vram": "~4 GB",
        "quality": "Good",
        "tier": 1,
        "hf_repo": "unsloth/gemma-4-E2B-it-GGUF",
        "hf_file": "Q4_K_M.gguf",
        "audio": True,
        "vision": True,
    },
    {
        "key": "gemma-4-e4b",
        "name": "Gemma 4 E4B",
        "size": "4B",
        "vram": "~6 GB",
        "quality": "Great",
        "tier": 2,
        "hf_repo": "unsloth/gemma-4-E4B-it-GGUF",
        "hf_file": "Q4_K_M.gguf",
        "audio": True,
        "vision": True,
    },
]


# Server process state
_server_process: Optional[subprocess.Popen] = None
_server_lock = threading.Lock()
_active_model_key: Optional[str] = None


def get_models_dir() -> Path:
    """Get the directory where GGUF models are cached."""
    d = settings.data_path / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def get_model_info(key: str) -> Optional[dict]:
    """Get model metadata by key."""
    for m in AVAILABLE_MODELS:
        if m["key"] == key:
            return m
    return None


def list_models() -> list:
    """List all available models with download status."""
    global _active_model_key
    result = []
    for m in AVAILABLE_MODELS:
        status = "not_installed"
        if is_model_downloaded(m["key"]):
            status = "active" if m["key"] == _active_model_key else "downloaded"
        result.append({**m, "status": status})
    return result


def is_model_downloaded(key: str) -> bool:
    """Check if a model's GGUF file exists in the HuggingFace cache."""
    # llama-server -hf auto-downloads to ~/.cache/huggingface/
    # We check if the server can load it by checking the cache
    info = get_model_info(key)
    if not info:
        return False
    # Check HuggingFace hub cache
    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    if not cache_dir.exists():
        return False
    # HF cache uses a hashed directory structure — simplest check is
    # to see if any file matching the repo name exists
    repo_slug = info["hf_repo"].replace("/", "--")
    model_cache = cache_dir / f"models--{repo_slug}"
    return model_cache.exists()


def download_model(key: str, progress_callback: Optional[Callable] = None) -> bool:
    """
    Download a model GGUF from HuggingFace.
    Uses llama-server's built-in -hf download (caches to ~/.cache/huggingface/).

    For the hackathon, we trigger a quick server start which auto-downloads,
    then stop it. The next real start will use the cached file.
    """
    info = get_model_info(key)
    if not info:
        return False

    hf_spec = f"{info['hf_repo']}:{info['hf_file'].replace('.gguf', '')}"

    print(f"[ModelManager] Downloading {info['name']} from {info['hf_repo']}...")

    try:
        # Use huggingface-cli to download (shows progress)
        cmd = [
            sys.executable, "-m", "huggingface_hub", "download",
            info["hf_repo"], info["hf_file"],
            "--local-dir-use-symlinks", "False",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            print(f"[ModelManager] Download complete: {info['name']}")
            return True
        else:
            print(f"[ModelManager] Download failed: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"[ModelManager] Download timed out")
        return False
    except Exception as e:
        print(f"[ModelManager] Download error: {e}")
        return False


def start_server(model_key: Optional[str] = None) -> bool:
    """
    Start llama-server with the specified model.
    If already running with the same model, does nothing.
    If running with a different model, restarts.
    """
    global _server_process, _active_model_key

    key = model_key or settings.active_model
    info = get_model_info(key)
    if not info:
        print(f"[ModelManager] Unknown model: {key}")
        return False

    with _server_lock:
        # Already running with this model?
        if _server_process and _server_process.poll() is None and _active_model_key == key:
            return True

        # Stop existing server (inline — we already hold the lock)
        if _server_process:
            try:
                _server_process.terminate()
                _server_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                _server_process.kill()
            except Exception:
                pass
            _server_process = None
            _active_model_key = None

        # Build llama-server command
        hf_spec = f"{info['hf_repo']}:{info['hf_file'].replace('.gguf', '')}"
        port = settings.llama_server_port

        # Find llama-server binary: check project's llama/ folder first, then PATH
        llama_bin = "llama-server"
        project_bin = Path(__file__).parent.parent / "llama" / "llama-server.exe"
        if project_bin.exists():
            llama_bin = str(project_bin)
        elif sys.platform == "win32":
            # Also check without .exe for PATH lookup
            llama_bin = "llama-server.exe"

        cmd = [
            llama_bin,
            "-hf", hf_spec,
            "--mmproj-auto",
            "--port", str(port),
            "-ngl", str(settings.num_gpu_layers),
            "-c", str(settings.context_window),
            "--parallel", "1",   # Single slot — analysis/audio/chat are sequential
            "--no-warmup",
        ]

        # Flash attention — faster + less VRAM, but not all GPUs support it
        if settings.flash_attention:
            cmd.extend(["--flash-attn", "on"])

        # KV cache quantization — saves ~60% KV VRAM with negligible quality loss
        if settings.kv_cache_quant:
            cmd.extend(["--cache-type-k", "q8_0", "--cache-type-v", "q4_0"])

        print(f"[ModelManager] Starting llama-server: {info['name']} on port {port}")

        try:
            startupinfo = None
            if sys.platform == "win32":
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = 0

            # Use DEVNULL for stdout/stderr to prevent pipe buffer deadlock.
            # llama-server writes a lot of logs — if we use PIPE and never read,
            # the OS buffer fills and the process hangs.
            _server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                startupinfo=startupinfo,
            )

            # Wait for server to be ready (poll /health)
            for i in range(60):  # 60s max wait
                time.sleep(1)
                if _server_process.poll() is not None:
                    print(f"[ModelManager] Server exited early (code: {_server_process.returncode})")
                    _server_process = None
                    return False
                try:
                    import httpx
                    r = httpx.get(f"http://127.0.0.1:{port}/health", timeout=2)
                    if r.status_code == 200:
                        _active_model_key = key
                        print(f"[ModelManager] Server ready ({i+1}s)")
                        return True
                except Exception:
                    pass

            print("[ModelManager] Server failed to start within 60s")
            stop_server()
            return False

        except FileNotFoundError:
            print("[ModelManager] llama-server not found. Install with: brew install llama.cpp")
            return False
        except Exception as e:
            print(f"[ModelManager] Failed to start server: {e}")
            return False


def stop_server():
    """Stop the running llama-server process."""
    global _server_process, _active_model_key

    with _server_lock:
        if _server_process:
            try:
                _server_process.terminate()
                _server_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                _server_process.kill()
            except Exception:
                pass
            _server_process = None
            _active_model_key = None
            print("[ModelManager] Server stopped")


def switch_model(key: str) -> bool:
    """Switch to a different model (restarts server)."""
    info = get_model_info(key)
    if not info:
        return False
    settings.save_runtime_overrides({"active_model": key})
    return start_server(key)


def get_active_model() -> Optional[str]:
    """Get the currently active model key."""
    return _active_model_key


def is_server_running() -> bool:
    """Check if llama-server process is alive."""
    return _server_process is not None and _server_process.poll() is None
