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

# Parse each operation in document order. The last occurrence of a major
# group before an operation belongs to the body section (the top navigation
# repeats the group names earlier in the HTML). Then select the last compact
# non-operation label after that group as the subtopic.
links = []
for anchor in soup.select("a[href]"):
    href = urljoin(URL, anchor.get("href", ""))
    text = re.sub(r"\s+", " ", anchor.get_text(" ", strip=True))
    if text and re.search(r"operacion\.htm", href, re.I):
        links.append((anchor, text, href))

operation_names = {norm(name) for _, name, _ in links}
raw = r.text
records = []
seen = set()

for anchor, name, href in links:
    anchor_html = str(anchor)
    pos = raw.find(anchor_html)
    if pos < 0:
        continue

    prefix = raw[:pos]
    prefix_soup = BeautifulSoup(prefix, "html.parser")
    strings = [re.sub(r"\s+", " ", x).strip()
               for x in prefix_soup.stripped_strings]
    strings = [x for x in strings if x]

    group = None
    group_index = -1
    for i in range(len(strings) - 1, -1, -1):
        g = group_by_norm.get(norm(strings[i]))
        if g:
            group = g
            group_index = i
            break

    topic = None
    if group_index >= 0:
        for text in reversed(strings[group_index + 1:]):
            n = norm(text)
            if n in group_by_norm:
                continue
            if n in operation_names:
                continue
            if n in {norm(x) for x in GENERIC}:
                continue
            if n in {
                "¿QUE ES INEBASE?",
                "ULTIMA MODIFICACION:",
                "DIMENSIONES:",
                "PERIODO:",
                "FORMATOS DE DESCARGA DISPONIBLES",
                "INFORMACION TABLA",
                "AVISO SOBRE DISPONIBILIDAD DE DATOS",
                "AVISO A LOS USUARIOS",
            }:
                continue
            if " | " in text:
                continue
            if len(text) > 100 or len(text.split()) > 10:
                continue
            if re.match(r"^(Año|Serie|Trimestre|Desde|Publicado|Últimos datos|Acceso directo)\b", text, re.I):
                continue
            topic = text
            break

    key = norm(name)
    if key in seen:
        continue
    seen.add(key)
    records.append({
        "name": name,
        "href": href,
        "group": group or "Otros",
        "topic": topic or "Otros",
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(records)} INEbase operations to {OUT}")
