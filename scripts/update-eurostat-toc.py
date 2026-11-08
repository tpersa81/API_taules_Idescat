#!/usr/bin/env python3
import csv, io, json, re, urllib.request
from pathlib import Path

URL = "https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en"
OUT = Path("data/eurostat-toc.json")

with urllib.request.urlopen(URL, timeout=60) as r:
    text = r.read().decode("utf-8")

rows = []
reader = csv.reader(io.StringIO(text), delimiter="\t", quotechar='"')
for row in reader:
    if len(row) < 3:
        continue
    title, code, typ = row[0].strip(), row[1].strip(), row[2].strip().lower()
    if not title or not code or typ not in {"folder", "dataset", "table"}:
        continue
    raw_indent = len(row[0]) - len(row[0].lstrip(" "))
    hierarchy = raw_indent // 4
    rows.append({"title": title, "code": code, "type": typ, "hierarchy": hierarchy})

if not rows:
    raise SystemExit("Eurostat TOC is empty or could not be parsed")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {len(rows)} TOC entries to {OUT}")
