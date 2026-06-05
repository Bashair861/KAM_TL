#!/usr/bin/env python3
"""Extract basic account fields from an uploaded SOW document.

The script prints JSON to stdout so the TanStack Start server function can
consume it. It uses only the Python standard library, with optional support for
pypdf/PyPDF2 when either package is available locally.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from datetime import date, datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree


CONTRACT_TYPES = {
    "staff augmented": "Staff Augmented",
    "staff augmentation": "Staff Augmented",
    "time based": "Time Based",
    "time-based": "Time Based",
    "retainer": "Retainer",
    "project": "Project",
}


def read_docx(path: Path) -> str:
    chunks: list[str] = []
    with zipfile.ZipFile(path) as docx:
        for name in docx.namelist():
            if not name.startswith("word/") or not name.endswith(".xml"):
                continue
            if name not in {"word/document.xml", "word/footnotes.xml", "word/endnotes.xml"}:
                continue
            root = ElementTree.fromstring(docx.read(name))
            for node in root.iter():
                if node.tag.endswith("}t") and node.text:
                    chunks.append(node.text)
    return "\n".join(chunks)


def read_pdf(path: Path) -> str:
    try:
        import pypdf  # type: ignore

        reader = pypdf.PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        pass

    try:
        import PyPDF2  # type: ignore

        reader = PyPDF2.PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return read_text_fallback(path)


def read_text_fallback(path: Path) -> str:
    raw = path.read_bytes()
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding, errors="ignore")
        except Exception:
            continue
    return ""


def read_document(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return read_docx(path)
    if suffix == ".pdf":
        return read_pdf(path)
    return read_text_fallback(path)


def compact(text: str) -> str:
    return re.sub(r"[ \t]+", " ", text.replace("\r", "\n"))


def first_match(text: str, patterns: list[str]) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
        if match:
            value = match.group(1).strip(" \t:-|")
            value = re.split(r"\n| {3,}", value)[0].strip()
            if value:
                return value[:160]
    return None


def parse_money(value: str | None) -> int | None:
    if not value:
        return None
    value = value.strip()
    multiplier = 1
    lowered = value.lower()
    if re.search(r"\d\s*(m|mn)\b|\bmillion\b", lowered):
        multiplier = 1_000_000
    elif re.search(r"\d\s*k\b|\bthousand\b", lowered):
        multiplier = 1_000

    match = re.search(r"[-+]?\d[\d,]*(?:\.\d+)?", value)
    if not match:
        return None
    return int(float(match.group(0).replace(",", "")) * multiplier)


def parse_contract_type(text: str) -> str | None:
    lowered = text.lower()
    for key, label in CONTRACT_TYPES.items():
        if re.search(rf"\b{re.escape(key)}\b", lowered):
            return label
    explicit = first_match(
        text,
        [
            r"contract\s+type\s*[:\-]\s*([^\n]+)",
            r"engagement\s+type\s*[:\-]\s*([^\n]+)",
            r"commercial\s+model\s*[:\-]\s*([^\n]+)",
        ],
    )
    if not explicit:
        return None
    normalized = explicit.lower()
    for key, label in CONTRACT_TYPES.items():
        if key in normalized:
            return label
    return None


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    cleaned = value.strip().rstrip(".")
    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B %Y",
        "%d %b %Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


def parse_renewal_days(text: str) -> tuple[int | None, str | None]:
    direct = first_match(text, [r"renews?\s+in\s+(\d{1,4})\s+days?", r"renewal\s+days?\s*[:\-]\s*(\d{1,4})"])
    if direct:
        return int(direct), None

    raw_date = first_match(
        text,
        [
            r"renewal\s+date\s*[:\-]\s*([A-Za-z0-9,/\- ]+)",
            r"renewal\s*[:\-]\s*([A-Za-z0-9,/\- ]+)",
            r"expiration\s+date\s*[:\-]\s*([A-Za-z0-9,/\- ]+)",
            r"expiry\s+date\s*[:\-]\s*([A-Za-z0-9,/\- ]+)",
            r"end\s+date\s*[:\-]\s*([A-Za-z0-9,/\- ]+)",
        ],
    )
    parsed = parse_date(raw_date)
    if not parsed:
        return None, raw_date
    return max((parsed - date.today()).days, 0), parsed.isoformat()


def extract_fields(text: str) -> dict[str, Any]:
    normalized = compact(text)

    account_name = first_match(
        normalized,
        [
            r"account\s+name\s*[:\-]\s*([^\n]+)",
            r"client\s+name\s*[:\-]\s*([^\n]+)",
            r"customer\s+name\s*[:\-]\s*([^\n]+)",
            r"company\s+name\s*[:\-]\s*([^\n]+)",
            r"statement\s+of\s+work\s+(?:for|with)\s+([^\n]+)",
        ],
    )

    arr = parse_money(
        first_match(
            normalized,
            [
                r"\bARR\b\s*[:\-]\s*([$A-Z0-9,.\s]+)",
                r"annual\s+recurring\s+revenue\s*[:\-]\s*([$A-Z0-9,.\s]+)",
            ],
        )
    )
    contract_value = parse_money(
        first_match(
            normalized,
            [
                r"contract\s+value\s*[:\-]\s*([$A-Z0-9,.\s]+)",
                r"total\s+contract\s+value\s*[:\-]\s*([$A-Z0-9,.\s]+)",
                r"total\s+fees?\s*[:\-]\s*([$A-Z0-9,.\s]+)",
                r"commercial\s+value\s*[:\-]\s*([$A-Z0-9,.\s]+)",
            ],
        )
    )
    renewal_days, renewal_date = parse_renewal_days(normalized)
    contract_duration = first_match(
        normalized,
        [
            r"contract\s+duration\s*[:\-]\s*([^\n]+)",
            r"duration\s*[:\-]\s*([^\n]+)",
            r"term\s*[:\-]\s*([^\n]+)",
        ],
    )

    return {
        "accountName": account_name,
        "arr": arr,
        "contractValue": contract_value,
        "renewalDays": renewal_days,
        "renewalDate": renewal_date,
        "contractType": parse_contract_type(normalized),
        "contractDuration": contract_duration,
        "textLength": len(normalized),
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: extract_sow_fields.py <file>"}))
        return 2

    path = Path(sys.argv[1])
    if not path.exists():
        print(json.dumps({"error": f"File not found: {path}"}))
        return 2

    text = read_document(path)
    fields = extract_fields(text)
    print(json.dumps(fields))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
