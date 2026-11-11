import json
import re
import unicodedata
from urllib.parse import urljoin
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = "https://www.ine.es/dyngs/INEbase/listaoperaciones.htm"
OUT = Path("data/inebase-navigation.json")

GROUPS = [
    "Agricultura y medio ambiente",
    "Ciencia y tecnología",
    "Demografía y población",
    "Economía",
    "Industria, energía y construcción",
    "Mercado laboral",
    "Servicios",
    "Nivel y condiciones de vida (IPC)",
    "Sociedad",
    "Estadísticas Experimentales",
    "Covid-19",
    "Síntesis estadística",
    "Clasificaciones estadísticas",
    "Estadísticas territoriales",
    "Información estadística europea",
    "ODS. Indicadores Agenda 2030",
    "Indicadores económicos. FMI",
    "Datos de alto valor. HVD",
    "Inventario de Operaciones Estadísticas (IOE)",
]

GENERIC = {
    "lista completa de operaciones",
    "operaciones estadísticas por orden alfabético",
    "lista completa de operaciones",
    "operaciones estadísticas que el ine elabora de forma periódica | últimos datos",
    "operaciones estadísticas sin periodicidad establecida o que el ine ha dejado de elaborar | últimos datos",
    "operaciones elaboradas por otros organismos del sistema estadistico nacional",
    "últimos datos",
}

def norm(s):
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().upper()

group_by_norm = {norm(x): x for x in GROUPS}

r = requests.get(URL, timeout=60, headers={"User-Agent": "Mozilla/5.0"})
r.raise_for_status()
soup = BeautifulSoup(r.text, "html.parser")

# INEbase uses the visible hierarchy of the page itself. We collect all
# operation links and derive the nearest group/topic from the document order.
links = []
for a in soup.select('a[href]'):
    href = urljoin(URL, a.get("href", ""))
    text = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
    if text and re.search(r"operacion\.htm", href, re.I):
        links.append((a, text, href))

# Use exact visible text nodes/elements so the navigation anchors in the
# top menu do not override the actual hierarchy in the body.
all_tags = soup.find_all(True)
tag_pos = {id(el): i for i, el in enumerate(all_tags)}
operation_ids = {id(a) for a, _, _ in links}

records = []
seen = set()

for a, name, href in links:
    pos = tag_pos.get(id(a))
    if pos is None:
        continue

    group = None
    group_pos = -1
    for i in range(pos - 1, -1, -1):
        el = all_tags[i]
        text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
        if len(text) <= 100 and norm(text) in group_by_norm:
            group = group_by_norm[norm(text)]
            group_pos = i
            break

    topic = None
    if group_pos >= 0:
        for i in range(group_pos + 1, pos):
            el = all_tags[i]
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            if not text or len(text) > 120:
                continue
            n = norm(text)
            if n in group_by_norm or n in {norm(x) for x in GENERIC}:
                continue
            if id(el) in operation_ids:
                continue
            # Prefer compact heading/list labels. Ignore metadata rows.
            if " | " in text or "Últimos datos" in text or "Ultimos datos" in text:
                continue
            if n in {norm(x) for _, x, _ in links}:
                continue
            # A candidate must look like a navigation label, not a paragraph.
            if len(text.split()) <= 10:
                topic = text

    group = group or "Otros"
    topic = topic or "Otros"

    key = norm(name)
    if key in seen:
        continue
    seen.add(key)
    records.append({
        "name": name,
        "href": href,
        "group": group,
        "topic": topic,
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(records)} INEbase operations to {OUT}")
