"""Generate a private PixPy roster seed without copying RA or email fields."""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


ROW = re.compile(
    r"^EF\s+(7[A-Z])\s+\d+\s+(.+?)\s+(?:amarelo|branco|\?)\s+\d+\s+\S+@\S+\s*$",
    re.IGNORECASE,
)


def ascii_token(value: str) -> str:
    # The source PDF's embedded font replaces a few accented glyphs with U+FFFD.
    # Repair only known name tokens before normalizing accents.
    repairs = {
        "JO�O": "JOAO",
        "M�XIMO": "MAXIMO",
        "ANDR�": "ANDRE",
        "JOS�": "JOSE",
        "CEC�LIA": "CECILIA",
        "MOUR�O": "MOURAO",
        "MAGALH�ES": "MAGALHAES",
        "GUSM�O": "GUSMAO",
        "LOB�O": "LOBAO",
    }
    value = " ".join(repairs.get(token.upper(), token) for token in value.split())
    normalized = unicodedata.normalize("NFD", value)
    return re.sub(r"[^a-z0-9]", "", normalized.encode("ascii", "ignore").decode().lower())


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/generate_roster_seed.py <roster.pdf>")

    source = Path(sys.argv[1]).resolve()
    target = Path(__file__).resolve().parents[1] / "supabase" / "roster.seed.local.sql"
    rows: list[tuple[str, str, str]] = []

    for page in PdfReader(source).pages:
        for line in (page.extract_text() or "").splitlines():
            match = ROW.match(line.strip())
            if not match:
                continue
            class_name, full_name = match.groups()
            parts = full_name.split()
            access_id = ascii_token(parts[0] + parts[-1])
            display_name = f"{parts[0].title()} {ascii_token(parts[-1])[:1].upper()}."
            rows.append((access_id, display_name, class_name.upper()))

    duplicates = sorted({access for access, _, _ in rows if sum(row[0] == access for row in rows) > 1})
    if duplicates:
        raise SystemExit(f"Duplicate access IDs need manual review: {', '.join(duplicates)}")
    if not rows:
        raise SystemExit("No roster rows were recognized. The PDF layout may have changed.")

    statements = [
        "-- PRIVATE LOCAL FILE. DO NOT COMMIT.",
        "begin;",
        *[
            f"select private.pixpy_seed_student({sql_text(access)}, {sql_text(display)}, {sql_text(class_name)});"
            for access, display, class_name in rows
        ],
        "commit;",
        "",
    ]
    target.write_text("\n".join(statements), encoding="utf-8")
    print(f"Generated {len(rows)} student access records in {target.name}.")


if __name__ == "__main__":
    main()
