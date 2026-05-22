"""
Sensitive Data Filter
Detects and redacts credit cards, SSNs, API keys, passwords from OCR text
before it's stored in the database or passed to AI models.
"""

import re
from typing import Optional


# ── Pattern Definitions ──────────────────────────────────────────────

PATTERNS = {
    "credit_card": {
        "label": "Credit Card",
        "regex": re.compile(
            r"\b(?:\d{4}[\s\-]?){3}\d{4}\b"
        ),
        "replacement": "[REDACTED:card]",
    },
    "ssn": {
        "label": "SSN",
        "regex": re.compile(
            r"\b\d{3}-\d{2}-\d{4}\b"
        ),
        "replacement": "[REDACTED:ssn]",
    },
    "api_key": {
        "label": "API Key",
        "regex": re.compile(
            r"\b(?:"
            r"sk-[A-Za-z0-9]{20,}"           # OpenAI
            r"|ghp_[A-Za-z0-9]{36,}"          # GitHub PAT
            r"|AKIA[A-Z0-9]{16}"              # AWS Access Key
            r"|xox[bps]-[A-Za-z0-9\-]{10,}"   # Slack
            r"|glpat-[A-Za-z0-9\-]{20,}"      # GitLab
            r"|AIza[A-Za-z0-9\-_]{35}"        # Google API
            r")\b",
            re.ASCII,
        ),
        "replacement": "[REDACTED:key]",
    },
    "password": {
        "label": "Password",
        "regex": re.compile(
            r"(?i)(?:password|passwd|pwd|secret|token|api.?key)"
            r"\s*[:=]\s*"
            r"[\"']?(\S{4,})[\"']?",
        ),
        "replacement": r"[REDACTED:password]",
    },
    "email": {
        "label": "Email Address",
        "regex": re.compile(
            r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b"
        ),
        "replacement": "[REDACTED:email]",
    },
}


def filter_sensitive_text(
    text: str,
    enabled_types: Optional[list] = None,
) -> dict:
    """
    Scan text and redact sensitive data.

    Args:
        text: Raw OCR / organized text
        enabled_types: List of pattern keys to apply.
            Defaults to ["credit_card", "ssn", "api_key", "password"]

    Returns:
        {
            "clean_text": "...",
            "redacted_count": 3,
            "types_found": ["credit_card", "api_key"],
            "details": [
                {"type": "credit_card", "count": 2},
                {"type": "api_key", "count": 1},
            ]
        }
    """
    if not text:
        return {
            "clean_text": text or "",
            "redacted_count": 0,
            "types_found": [],
            "details": [],
        }

    if enabled_types is None:
        enabled_types = ["credit_card", "ssn", "api_key", "password"]

    clean = text
    total_redacted = 0
    types_found = []
    details = []

    for ptype in enabled_types:
        pattern_info = PATTERNS.get(ptype)
        if not pattern_info:
            continue

        regex = pattern_info["regex"]
        replacement = pattern_info["replacement"]

        # Count matches before replacing
        matches = regex.findall(clean)
        count = len(matches)

        if count > 0:
            # For password pattern, the replacement is slightly different
            # because the regex captures the password value in group 1
            if ptype == "password":
                # Replace the whole match (password: value) with redacted
                clean = regex.sub(replacement, clean)
            else:
                clean = regex.sub(replacement, clean)

            total_redacted += count
            types_found.append(ptype)
            details.append({"type": ptype, "count": count})

    if total_redacted > 0:
        print(f"[Privacy] Redacted {total_redacted} sensitive item(s): {', '.join(types_found)}")

    return {
        "clean_text": clean,
        "redacted_count": total_redacted,
        "types_found": types_found,
        "details": details,
    }


def parse_enabled_types(types_str: str) -> list:
    """Parse comma-separated filter types string into a list."""
    if not types_str:
        return ["credit_card", "ssn", "api_key", "password"]
    return [t.strip() for t in types_str.split(",") if t.strip() in PATTERNS]
