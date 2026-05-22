"""Tests for privacy/data_filter.py — sensitive data redaction."""

from privacy.data_filter import filter_sensitive_text, parse_enabled_types


def test_redact_credit_card():
    text = "My card is 4111-1111-1111-1111 thanks"
    result = filter_sensitive_text(text, ["credit_card"])
    assert "[REDACTED:card]" in result["clean_text"]
    assert "4111" not in result["clean_text"]
    assert result["redacted_count"] == 1
    assert "credit_card" in result["types_found"]


def test_redact_ssn():
    text = "SSN: 123-45-6789"
    result = filter_sensitive_text(text, ["ssn"])
    assert "[REDACTED:ssn]" in result["clean_text"]
    assert "123-45-6789" not in result["clean_text"]


def test_redact_api_key_openai():
    text = "key: sk-abcdefghijklmnopqrstuvwxyz1234567890"
    result = filter_sensitive_text(text, ["api_key"])
    assert "[REDACTED:key]" in result["clean_text"]


def test_redact_api_key_github():
    text = "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij"
    result = filter_sensitive_text(text, ["api_key"])
    assert "[REDACTED:key]" in result["clean_text"]


def test_redact_password():
    text = "password: mysecretpass123"
    result = filter_sensitive_text(text, ["password"])
    assert "[REDACTED:password]" in result["clean_text"]
    assert "mysecretpass123" not in result["clean_text"]


def test_no_redaction_clean_text():
    text = "Just a normal sentence about coding in Python."
    result = filter_sensitive_text(text, ["credit_card", "ssn", "api_key", "password"])
    assert result["clean_text"] == text
    assert result["redacted_count"] == 0
    assert result["types_found"] == []


def test_empty_text():
    result = filter_sensitive_text("", ["credit_card"])
    assert result["clean_text"] == ""
    assert result["redacted_count"] == 0


def test_none_text():
    result = filter_sensitive_text(None, ["credit_card"])
    assert result["clean_text"] == ""


def test_multiple_redactions():
    text = "Card: 4111 1111 1111 1111, SSN: 999-88-7777, key: sk-AAAABBBBCCCCDDDDEEEEFFFFGGGG"
    result = filter_sensitive_text(text, ["credit_card", "ssn", "api_key"])
    assert result["redacted_count"] == 3
    assert len(result["types_found"]) == 3


def test_parse_enabled_types():
    assert parse_enabled_types("credit_card,ssn") == ["credit_card", "ssn"]
    assert parse_enabled_types("") == ["credit_card", "ssn", "api_key", "password"]
    assert parse_enabled_types("invalid,credit_card") == ["credit_card"]
