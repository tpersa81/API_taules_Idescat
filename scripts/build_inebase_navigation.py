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

# Parse the visible document stream. INEbase places the major group and
# subtopic labels before the operation links, while the operation names
# themselves are anchors. Tracking that stream reproduces the web hierarchy
# without depending on INE's presentation CSS classes.
operation_lookup = {}
for anchor, name, href in links:
    operation_lookup[id(anchor)] = (name, href)

records = []
seen = set()
current_group = None
current_topic = None

for node in soup.descendants:
    if getattr(node, "name", None) == "a":
        info = operation_lookup.get(id(node))
        if info:
            name, href = info
            key = norm(name)
            if key not in seen:
                seen.add(key)
                records.append({
                    "name": name,
                    "href": href,
                    "group": current_group or "Otros",
                    "topic": current_topic or "Otros",
                })
        continue

    if not getattr(node, "strip", lambda: False)():
        continue

    parent_a = getattr(node, "parent", None)
    while parent_a is not None and getattr(parent_a, "name", None) != "a":
        parent_a = getattr(parent_a, "parent", None)
    if parent_a is not None and id(parent_a) in operation_lookup:
        continue

    text = re.sub(r"\s+", " ", str(node)).strip()
    if not text or len(text) > 120:
        continue

    n = norm(text)
    if n in group_by_norm:
        current_group = group_by_norm[n]
        current_topic = None
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

    # Navigation subtopics are short labels such as "Actividad, ocupación y
    # paro", "Agricultura" or "Construcción y vivienda". Ignore table/update
    # metadata and long explanatory paragraphs.
    if current_group and len(text.split()) <= 10:
        if not re.match(r"^(Año|Serie|Trimestre|Desde|Publicado|Últimos datos|Acceso directo)\b", text, re.I):
            current_topic = text

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Wrote {len(records)} INEbase operations to {OUT}")
