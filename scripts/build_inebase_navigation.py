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

# Build a document-order list of useful text-bearing elements.
elements = []
for el in soup.find_all(["h1","h2","h3","h4","h5","h6","strong","b","dt","a"]):
    text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
    if text:
        elements.append((el, text))

records = []
seen = set()
for a, name, href in links:
    # Find this anchor in the flattened element stream.
    try:
        pos = next(i for i, (el, _) in enumerate(elements) if el is a)
    except StopIteration:
        continue

    group = None
    topic = None

    # Look backwards far enough to cross the small table/list wrappers used
    # by INEbase, but stop when a new major group is found.
    for _, text in reversed(elements[max(0, pos - 500):pos]):
        n = norm(text)
        if n in group_by_norm:
            group = group_by_norm[n]
            break

    if group:
        gn = norm(group)
        # Find the nearest plausible subtopic after the group and before the
        # operation. Prefer heading/list labels and reject operational rows.
        start = 0
        for i in range(pos - 1, -1, -1):
            if norm(elements[i][1]) == gn:
                start = i + 1
                break
        candidates = []
        for el, text in elements[start:pos]:
            n = norm(text)
            if not text or n in GENERIC or n in group_by_norm:
                continue
            if el.name == "a" and re.search(r"operacion\.htm", el.get("href",""), re.I):
                continue
            if len(text) > 100:
                continue
            # Table header rows and update labels are not topics.
            if " | " in text or "ÚLTIMOS DATOS" in n or "ULTIMOS DATOS" in n:
                continue
            candidates.append(text)
        if candidates:
            topic = candidates[-1]

    if not group:
        group = "Otros"
    if not topic:
        topic = "Otros"

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
