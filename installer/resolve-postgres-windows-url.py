#!/usr/bin/env python3
"""Gibt die EDB-Download-URL fuer PostgreSQL Windows x64 Binaries aus (major.minor, z. B. 16.14)."""
from __future__ import annotations

import re
import sys
import urllib.request

PAGE = "https://www.enterprisedb.com/download-postgresql-binaries"
USER_AGENT = "Mozilla/5.0 (compatible; PhiX-Build/1.0)"


def resolve_url(major_minor: str) -> str:
    req = urllib.request.Request(PAGE, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    section_pat = (
        rf"Version\s*(?:<!--\s*-->)?\s*{re.escape(major_minor)}\b"
        rf".*?(?=Version\s*(?:<!--\s*-->)?\s*\d+\.\d+|$)"
    )
    section = re.search(section_pat, html, re.DOTALL | re.I)
    if not section:
        raise RuntimeError(
            f"PostgreSQL-Version {major_minor} nicht auf der EDB-Seite gefunden."
        )

    chunk = section.group(0)
    for m in re.finditer(
        r'href="(https://sbp\.enterprisedb\.com/getfile\.jsp\?fileid=\d+)"[^>]*>\s*<img[^>]*alt="([^"]+)"',
        chunk,
        re.I,
    ):
        alt = m.group(2).lower()
        if "windows" in alt and "x86-64" in alt:
            return m.group(1)

    raise RuntimeError(
        f"Kein Windows-x64-Download fuer PostgreSQL {major_minor} auf der EDB-Seite gefunden."
    )


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else "16.14"
    m = re.match(r"^(\d+\.\d+)", version.strip())
    if not m:
        print(f"Ungueltige Version: {version}", file=sys.stderr)
        sys.exit(2)
    try:
        print(resolve_url(m.group(1)))
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
