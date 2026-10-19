const API = 'https://api.idescat.cat/taules/v2';
const MAX_CELLS = 20000;

const state = {
  stats: [],
  nodes: [],
  tables: [],
  geos: [],
  metadata: null,
  lastData: null,
  selected: {
    stat: '',
    concept: '',
    cross: '',
    node: '',
    table: '',
    geo: ''
  },
  filters: new Map(),
  fallbackCatalog: [],
  page: 1,
  pageSize: 100,
  requestToken: 0,
  pivot: {
    rows: [],
    columns: []
  }
};

const $ = id => document.getElementById(id);

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);

  let data;

  try {
    data = await r.json();
  } catch {
    throw new Error(`Resposta no vàlida de l'API (HTTP ${r.status}).`);
  }

  if (!r.ok || data?.class === 'error') {
    throw new Error(
      data?.label || `Error HTTP ${r.status}.`
    );
  }

  return data;
}

function optionLabel(x) {
  return x?.label ?? x?.value ?? '';
}

function fill(
  sel,
  items,
  placeholder = '— Selecciona —'
) {
  const old = sel.value;

  sel.innerHTML = '';

  if (placeholder !== null) {
    sel.append(new Option(placeholder, ''));
  }

  for (const x of items) {
    sel.append(
      new Option(optionLabel(x), x.value)
    );
  }

  if (
    [...sel.options].some(
      o => o.value === old
    )
  ) {
    sel.value = old;
  }
}

function resetSelect(id) {
  $(id).innerHTML =
    '<option value="">— Selecciona —</option>';

  $(id).disabled = true;
}

function setBusy(b) {
  document.body.classList.toggle('busy', b);
}

function status(s, type = '') {
  $('status').textContent = s;
  $('status').className = type;
}

function currentPath() {
  const s = state.selected;

  return `${API}/${encodeURIComponent(s.stat)}/${encodeURIComponent(s.node)}/${encodeURIComponent(s.table)}/${encodeURIComponent(s.geo)}`;
}

function setStep(step, done) {
  const el = $(`step${step}`);

  if (el) {
    el.classList.toggle('done', done);
  }
}

function resetBelow(level) {
  if (level === 'stat') {
    state.selected.concept = '';
    state.selected.cross = '';
    state.selected.node = '';
    state.selected.table = '';
    state.selected.geo = '';

    resetSelect('concept');
    resetSelect('cross');
    resetSelect('node');
    resetSelect('table');
    resetSelect('geo');

  } else if (
    level === 'concept' ||
    level === 'cross'
  ) {
    state.selected.node = '';
    state.selected.table = '';
    state.selected.geo = '';

    resetSelect('node');
    resetSelect('table');
    resetSelect('geo');

  } else if (level === 'node') {
    state.selected.table = '';
    state.selected.geo = '';

    resetSelect('table');
    resetSelect('geo');

  } else {
    state.selected.geo = '';
    resetSelect('geo');
  }

  state.metadata = null;
  state.filters.clear();

  $('filters').innerHTML = '';
  $('results').innerHTML = '';

  $('query').disabled = true;
  $('exportCsv').disabled = true;
  $('exportXlsx').disabled = true;

  $('tableInfo').hidden = true;
  $('cellInfo').hidden = true;

  state.lastData = null;

  state.pivot.rows = [];
  state.pivot.columns = [];

  $('pivotBuilder').innerHTML = '';

  setStep(2, false);
  setStep(3, false);
  setStep(4, false);
}

async function loadStats() {
  const ds = await fetchJson(
    `${API}?lang=ca`
  );

  state.stats = collectionItems(ds)
    .map(x => ({
      value: String(x.id),
      label: `${x.id} · ${x.label}`
    }))
    .sort((a, b) =>
      a.value.localeCompare(
        b.value,
        'ca',
        { numeric: true }
      )
    );

  fill($('stat'), state.stats);

  const initial =
    new URLSearchParams(location.search)
      .get('stat') || '';

  if (initial) {
    $('stat').value = initial;
    await onStatChange();
  }
}

async function onStatChange() {
  state.selected.stat =
    $('stat').value;

  resetBelow('stat');

  if (!state.selected.stat) {
    status('');
    updateUrl();
    return;
  }

  setBusy(true);
  status(
    "Construint el Catàleg de l'estadística…"
  );

  try {
    const ds = await fetchJson(
      `${API}/${encodeURIComponent(state.selected.stat)}?lang=ca`
    );

    const rawNodes = collectionItems(ds)
      .map(x => ({
        value: String(x.id),
        label: String(x.label || '')
      }));

    const rows = rawNodes.map(n => ({
      Node: n.value,
      NomNode: n.label,
      Concepte: deriveConcept(n.label),
      Encreuament:
        deriveCrossFromNode(n.label)
    }));

    state.nodes = rawNodes;
    state.fallbackCatalog = rows;

    const concepts = unique(
      rows
        .map(r => r.Concepte)
        .filter(Boolean)
    ).sort((a, b) =>
      a.localeCompare(b, 'ca')
    );

    fill(
      $('concept'),
      concepts.map(v => ({
        value: v,
        label: v
      }))
    );

    $('concept').disabled =
      concepts.length === 0;

    $('cross').disabled = true;

    if (concepts.length) {
      status(
        countMessage(
          concepts.length,
          'concepte',
          'conceptes',
          "Tria'l",
          "Tria'n un"
        )
      );
    } else {
      status(
        "Aquesta estadística no té conceptes disponibles.",
        'error'
      );
    }

    setStep(
      2,
      concepts.length > 0
    );

  } catch (e) {
    status(e.message, 'error');

  } finally {
    setBusy(false);
    updateUrl();
  }
}

function unique(a) {
  return [...new Set(a)];
}

function countMessage(
  n,
  singular,
  plural,
  oneEnding,
  manyEnding
) {
  if (n === 1) {
    return `S'ha trobat 1 ${singular}. ${oneEnding}`;
  }

  return `S'han trobat ${n} ${plural}. ${manyEnding}`;
}

function deriveConcept(nodeLabel) {
  const n = String(nodeLabel ?? '');
  const p = n.indexOf('.');

  return p >= 0
    ? n.slice(0, p)
    : n;
}

function deriveCrossFromNode(nodeLabel) {
  const n =
    String(nodeLabel ?? '').trim();

  const start = n.indexOf('. ');

  if (start < 0) {
    return '';
  }

  const rest =
    n.slice(start + 2).trim();

  const end =
    rest.indexOf('. A');

  return (
    end >= 0
      ? rest.slice(0, end)
      : rest
  ).trim();
}

async function apiTablesForNode(nodeId) {
  const ds = await fetchJson(
    `${API}/${encodeURIComponent(state.selected.stat)}/${encodeURIComponent(nodeId)}?lang=ca`
  );

  return collectionItems(ds).map(
    x => ({
      value: String(x.id),
      label: String(x.label)
    })
  );
}

function deriveCross(
  nodeLabel,
  tableLabel,
  tableCount
) {
  return deriveCrossFromNode(nodeLabel);
}

async function mapLimit(
  items,
  limit,
  fn
) {
  const out = new Array(items.length);
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;

      if (i >= items.length) {
        return;
      }

      out[i] =
        await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          limit,
          Math.max(1, items.length)
        )
      },
      worker
    )
  );

  return out;
}

async function buildCatalogForConcept(
  concept
) {
  const conceptNodes =
    state.nodes.filter(
      n => n.label === concept
    );

  const chunks =
    await mapLimit(
      conceptNodes,
      8,
      async node => ({
        node,
        tables:
          await apiTablesForNode(
            node.value
          )
      })
    );

  const rows = [];

  for (const chunk of chunks) {
    const count =
      chunk.tables.length;

    for (const table of chunk.tables) {
      rows.push({
        Estadística:
          state.selected.stat,
        Concepte:
          chunk.node.label,
        Encreuament:
          deriveCross(
            chunk.node.label,
            table.label,
            count
          ),
        Node:
          chunk.node.value,
        NomNode:
          chunk.node.label,
        Taula:
          table.value,
        NomTaula:
          table.label
      });
    }
  }

  state.fallbackCatalog = rows;

  return rows;
}

async function updateCrossOptions() {
  const concept =
    $('concept').value;

  resetSelect('node');
  resetSelect('table');
  resetSelect('geo');

  state.selected.node = '';
  state.selected.table = '';
  state.selected.geo = '';
  state.selected.cross = '';

  state.metadata = null;
  state.filters.clear();

  $('filters').innerHTML = '';
  $('results').innerHTML = '';

  $('query').disabled = true;
  $('exportCsv').disabled = true;
  $('exportXlsx').disabled = true;

  $('tableInfo').hidden = true;
  $('cellInfo').hidden = true;

  if (!concept) {
    resetSelect('cross');
    return;
  }

  const crosses =
    unique(
      state.fallbackCatalog
        .filter(
          r => r.Concepte === concept
        )
        .map(r => r.Encreuament)
        .filter(Boolean)
    ).sort((a, b) =>
      a.localeCompare(b, 'ca')
    );

  fill(
    $('cross'),
    crosses.map(v => ({
      value: v,
      label: v
    }))
  );

  $('cross').disabled =
    crosses.length === 0;

  if (!crosses.length) {
    state.selected.cross = '';
    $('cross').disabled = true;

    const rowsNoCross =
      state.fallbackCatalog.filter(
        r => r.Concepte === concept
      );

    const ids =
      unique(
        rowsNoCross
          .map(r => String(r.Node))
          .filter(Boolean)
      ).sort((a, b) =>
        a.localeCompare(
          b,
          'ca',
          { numeric: true }
        )
      );

    const nodeItems =
      ids.map(id => {
        const r =
          rowsNoCross.find(
            x => String(x.Node) === id
          );

        return {
          value: id,
          label:
            `${id} · ${r?.NomNode ?? id}`
        };
      });

    state.nodesFiltered =
      nodeItems;

    fill(
      $('node'),
      nodeItems
    );

    $('node').disabled =
      nodeItems.length === 0;

    setStep(
      3,
      nodeItems.length > 0
    );

    status(
      nodeItems.length
        ? countMessage(
            nodeItems.length,
            'node',
            'nodes',
            "Tria'l",
            "Tria'n un"
          )
        : 'Aquest concepte no té nodes disponibles.',
      nodeItems.length
        ? ''
        : 'error'
    );

    if (
      nodeItems.length === 1
    ) {
      $('node').value =
        nodeItems[0].value;

      await onNodeChange();
    }

  } else {
    status(
      countMessage(
        crosses.length,
        'encreuament',
        'encreuaments',
        "Tria'l",
        "Tria'n un"
      )
    );

    if (crosses.length === 1) {
      $('cross').value =
        crosses[0];

      await loadNodesForSelection();
    }
  }

  updateUrl();
}

async function loadNodesForSelection() {
  const concept =
    $('concept').value;

  const cross =
    $('cross').value;

  state.selected.cross =
    cross;

  resetSelect('node');
  resetSelect('table');
  resetSelect('geo');

  state.selected.node = '';
  state.selected.table = '';
  state.selected.geo = '';

  const rows =
    state.fallbackCatalog.filter(
      r =>
        r.Concepte === concept &&
        r.Encreuament === cross
    );

  const ids =
    unique(
      rows
        .map(r => String(r.Node))
        .filter(Boolean)
    ).sort((a, b) =>
      a.localeCompare(
        b,
        'ca',
        { numeric: true }
      )
    );

  const nodeItems =
    ids.map(id => {
      const r =
        rows.find(
          x => String(x.Node) === id
        );

      return {
        value: id,
        label:
          `${id} · ${r?.NomNode ?? id}`
      };
    });

  state.nodesFiltered =
    nodeItems;

  fill(
    $('node'),
    nodeItems
  );

  $('node').disabled =
    nodeItems.length === 0;

  if (!nodeItems.length) {
    status(
      'No hi ha nodes per a aquesta combinació.',
      'error'
    );

  } else {
    status(
      countMessage(
        nodeItems.length,
        'node',
        'nodes',
        "Tria'l",
        "Tria'n un"
      )
    );

    if (
      nodeItems.length === 1
    ) {
      $('node').value =
        nodeItems[0].value;

      await onNodeChange();
    }
  }

  setStep(
    3,
    nodeItems.length > 0
  );

  updateUrl();
}

async function onNodeChange() {
  state.selected.node =
    $('node').value;

  state.selected.table = '';
  state.selected.geo = '';

  resetSelect('table');
  resetSelect('geo');

  $('tableInfo').hidden = true;
  $('filters').innerHTML = '';
  $('cellInfo').hidden = true;
  $('results').innerHTML = '';

  $('query').disabled = true;
  $('exportCsv').disabled = true;
  $('exportXlsx').disabled = true;

  if (!state.selected.node) {
    return;
  }

  setBusy(true);
  status(
    'Carregant les taules del node…'
  );

  try {
    const apiTables =
      await apiTablesForNode(
        state.selected.node
      );

    const byId = new Map();

    for (const table of apiTables) {
      const id =
        String(table.value ?? '');

      if (!id) {
        continue;
      }

      byId.set(
        id,
        {
          value: id,
          label:
            String(
              table.label ||
              `Taula ${id}`
            )
        }
      );
    }

    state.tables =
      [...byId.values()];

    fill(
      $('table'),
      state.tables
    );

    $('table').disabled =
      state.tables.length === 0;

    setStep(
      3,
      state.tables.length > 0
    );

    status(
      state.tables.length
        ? countMessage(
            state.tables.length,
            'taula',
            'taules',
            'Tria-la',
            "Tria'n una"
          )
        : 'No hi ha taules per a aquest node.'
    );

    if (
      state.tables.length === 1
    ) {
      $('table').value =
        state.tables[0].value;

      await onTableChange();
    }

  } catch (e) {
    status(
      e.message,
      'error'
    );

  } finally {
    setBusy(false);
    updateUrl();
  }
}

async function onTableChange() {
  state.selected.table =
    $('table').value;

  state.selected.geo = '';

  resetSelect('geo');

  state.metadata = null;
  state.filters.clear();

  $('filters').innerHTML = '';
  $('cellInfo').hidden = true;
  $('results').innerHTML = '';

  $('query').disabled = true;
  $('exportCsv').disabled = true;
  $('exportXlsx').disabled = true;

  if (!state.selected.table) {
    return;
  }

  setBusy(true);
  status(
    'Carregant geografies…'
  );

  try {
    const ds =
      await fetchJson(
        `${API}/${state.selected.stat}/${state.selected.node}/${state.selected.table}?lang=ca`
      );

    state.geos =
      collectionItems(ds).map(
        x => ({
          value: x.id,
          label:
            `${x.id} · ${x.label}`
        })
      );

    fill(
      $('geo'),
      state.geos
    );

    $('geo').disabled =
      state.geos.length === 0;

    setStep(
      4,
      state.geos.length > 0
    );

    status(
      state.geos.length
        ? countMessage(
            state.geos.length,
            'geografia',
            'geografies',
            'Tria-la',
            "Tria'n una"
          )
        : 'No hi ha geografies per a aquesta taula.'
    );

    if (
      state.geos.length === 1
    ) {
      $('geo').value =
        state.geos[0].value;

      await onGeoChange();
    }

  } catch (e) {
    status(
      e.message,
      'error'
    );

  } finally {
    setBusy(false);
    updateUrl();
  }
}

async function onGeoChange() {
  state.selected.geo =
    $('geo').value;

  state.metadata = null;
  state.filters.clear();

  $('filters').innerHTML = '';
  $('results').innerHTML = '';

  $('query').disabled = true;
  $('exportCsv').disabled = true;
  $('exportXlsx').disabled = true;

  if (!state.selected.geo) {
    return;
  }

  setBusy(true);
  status(
    'Carregant les dimensions…'
  );

  try {
    state.metadata =
      await fetchJson(
        `${currentPath()}?lang=ca`
      );

    renderMetadata(
      state.metadata
    );

    $('tableInfo').hidden = false;

    $('tableInfo').innerHTML =
      `<strong>Taula triada:</strong> ${esc(state.metadata.label || '')}<span class="path">${esc(currentPath())}</span>`;

    $('query').disabled = false;

    setStep(4, true);

    status('');

  } catch (e) {
    status(
      e.message,
      'error'
    );

  } finally {
    setBusy(false);
    updateUrl();
  }
}

function collectionItems(ds) {
  if (ds?.class === 'collection') {
    const items =
      Array.isArray(ds.link?.item)
        ? ds.link.item
        : [];

    return items
      .map(item => {
        let id =
          item?.id ??
          item?.extension?.id ??
          '';

        if (!id && item?.href) {
          try {
            const u =
              new URL(
                item.href,
                API + '/'
              );

            const parts =
              u.pathname
                .split('/')
                .filter(Boolean);

            id =
              parts.at(-1) || '';

          } catch {
            const parts =
              String(item.href)
                .split('/')
                .filter(Boolean);

            id =
              parts.at(-1) || '';
          }
        }

        return {
          id: String(id),
          label:
            item?.label ??
            String(id)
        };
      })
      .filter(x => x.id);
  }

  if (ds?.class === 'dataset') {
    const ids =
      ds.id || [];

    if (!ids.length) {
      return [];
    }

    return jsonstatCategories(
      ds,
      ids[0]
    ).map(x => ({
      id: x.code,
      label: x.label
    }));
  }

  return [];
}

function jsonstatCategories(
  ds,
  id
) {
  const cat =
    ds.dimension?.[id]?.category ||
    {};

  const labels =
    cat.label &&
    typeof cat.label === 'object'
      ? cat.label
      : {};

  const result = [];

  /*
   * JSON-stat permet que category.index sigui:
   *
   *  - un array:
   *      ["01", "02", "03"]
   *
   *  - un objecte:
   *      {"01": 0, "02": 1, "03": 2}
   *
   * Guardem sempre la posició original en "index".
   */

  if (
    Array.isArray(cat.index)
  ) {
    cat.index.forEach(
      (code, index) => {
        const c =
          String(code);

        result.push({
          code: c,
          label:
            String(
              labels[c] ?? c
            ),
          index
        });
      }
    );

    return result;
  }

  if (
    cat.index &&
    typeof cat.index === 'object'
  ) {
    return Object.entries(
      cat.index
    )
      .map(
        ([code, index]) => ({
          code:
            String(code),
          label:
            String(
              labels[code] ?? code
            ),
          index:
            Number(index)
        })
      )
      .sort(
        (a, b) =>
          a.index - b.index
      );
  }

  /*
   * Dimensions amb una única categoria
   * poden no tenir "index".
   */

  const codes =
    Object.keys(labels);

  return codes.map(
    (code, index) => ({
      code:
        String(code),
      label:
        String(
          labels[code] ?? code
        ),
      index
    })
  );
}

function dimensions(ds) {
  return (
    ds.id || []
  ).map(id => {
    const d =
      ds.dimension?.[id] ||
      {};

    return {
      id,
      label:
        d.label || id,
      role:
        d.extension?.role ||
        d.role ||
        '',
      categories:
        jsonstatCategories(
          ds,
          id
        )
    };
  });
}

function capitalizeFirst(str) {
  return str
    ? str.charAt(0).toUpperCase() +
        str.slice(1)
    : str;
}


/* =====================================================
   ORDENACIÓ TERRITORIAL
   ===================================================== */

function provinceSortOrder(code) {
  const order = {
    '08': 1,
    '17': 2,
    '25': 3,
    '43': 4,
    '99': 5
  };

  const c = String(code);

  if (
    c === 'cat' ||
    c === 'CAT' ||
    c === 'Total' ||
    c === 'TOTAL'
  ) {
    return 6;
  }

  return order[c] ?? 999;
}

function comarcaSortOrder(code) {
  const order = {
    '01': 1,
    '02': 2,
    '03': 3,
    '04': 4,
    '05': 5,
    '06': 6,
    '39': 7,
    '07': 8,
    '08': 9,
    '09': 10,
    '10': 11,
    '11': 12,
    '12': 13,
    '13': 14,
    '14': 15,
    '15': 16,
    '16': 17,
    '17': 18,
    '18': 19,
    '19': 20,
    '20': 21,
    '43': 22,
    '21': 23,
    '42': 24,
    '22': 25,
    '23': 26,
    '24': 27,
    '25': 28,
    '26': 29,
    '27': 30,
    '28': 31,
    '29': 32,
    '30': 33,
    '31': 34,
    '32': 35,
    '33': 36,
    '34': 37,
    '35': 38,
    '36': 39,
    '37': 40,
    '38': 41,
    '40': 42,
    '41': 43,
    '77': 44
  };

  const c = String(code);

  if (
    c === 'cat' ||
    c === 'CAT' ||
    c === 'Total' ||
    c === 'TOTAL'
  ) {
    return 45;
  }

  return order[c] ?? 999;
}

function territorialSortOrder(
  dim,
  code
) {
  const id =
    String(dim?.id || '')
      .toLowerCase();

  const label =
    String(dim?.label || '')
      .trim()
      .toLowerCase();

  if (
    id === 'prov' ||
    label === 'província' ||
    label === 'provincia'
  ) {
    return provinceSortOrder(
      code
    );
  }

  if (
    id === 'com' ||
    label === 'comarca' ||
    label === 'comarques'
  ) {
    return comarcaSortOrder(
      code
    );
  }

  return null;
}

function isTerritorialDimension(
  dim
) {
  return (
    territorialSortOrder(
      dim,
      '__TEST__'
    ) !== null
  );
}

function sortCategories(
  categories,
  dim
) {
  if (
    !isTerritorialDimension(dim)
  ) {
    return categories;
  }

  return [...categories].sort(
    (a, b) => {
      const oa =
        territorialSortOrder(
          dim,
          a.code
        );

      const ob =
        territorialSortOrder(
          dim,
          b.code
        );

      if (oa !== ob) {
        return oa - ob;
      }

      return String(a.code)
        .localeCompare(
          String(b.code),
          'ca',
          { numeric: true }
        );
    }
  );
}

function sortRowsTerritorially(
  rows,
  dims
) {
  const territorialDims =
    dims.filter(
      isTerritorialDimension
    );

  if (!territorialDims.length) {
    return rows;
  }

  return [...rows].sort(
    (a, b) => {
      for (
        const dim of territorialDims
      ) {
        const ac =
          String(
            a[dim.id]?.code ?? ''
          );

        const bc =
          String(
            b[dim.id]?.code ?? ''
          );

        const ao =
          territorialSortOrder(
            dim,
            ac
          );

        const bo =
          territorialSortOrder(
            dim,
            bc
          );

        if (ao !== bo) {
          return ao - bo;
        }

        if (ac !== bc) {
          return ac.localeCompare(
            bc,
            'ca',
            { numeric: true }
          );
        }
      }

      return 0;
    }
  );
}


/* =====================================================
   FILTRES
   ===================================================== */

function renderMetadata(ds) {
  const dims =
    dimensions(ds);

  state.filters.clear();

  const box =
    $('filters');

  box.innerHTML = '';

  for (const d of dims) {
    const categories =
      sortCategories(
        d.categories,
        d
      );

    const defaultCodes =
      categories.map(
        x => x.code
      );

    state.filters.set(
      d.id,
      new Set(defaultCodes)
    );

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'filter';

    section.dataset.dim =
      d.id;

    section.innerHTML =
      `<div class="filter-head"><div><h3>${esc(capitalizeFirst(d.label))}</h3><span class="role">${esc(d.role || '')}</span></div><span class="selected-count"></span></div>`;

    const toolbar =
      document.createElement(
        'div'
      );

    toolbar.className =
      'filter-tools';

    const all =
      document.createElement(
        'button'
      );

    all.className =
      'secondary';

    all.textContent =
      'Tots';

    const none =
      document.createElement(
        'button'
      );

    none.className =
      'secondary';

    none.textContent =
      'Cap';

    toolbar.append(
      all,
      none
    );

    section.append(
      toolbar
    );

    const list =
      document.createElement(
        'div'
      );

    list.className =
      'options';

    for (
      const c of categories
    ) {
      const option =
        document.createElement(
          'button'
        );

      option.type =
        'button';

      option.className =
        'option selected';

      option.dataset.search =
        (
          c.code +
          ' ' +
          c.label
        ).toLocaleLowerCase();

      option.dataset.code =
        c.code;

      option.setAttribute(
        'aria-pressed',
        state.filters
          .get(d.id)
          .has(c.code)
          ? 'true'
          : 'false'
      );

      option.innerHTML =
        `<span class="option-label">${esc(c.label)}</span><small>${esc(c.code)}</small>`;

      option.addEventListener(
        'click',
        () => {
          const s =
            state.filters.get(
              d.id
            );

          if (
            s.has(c.code)
          ) {
            s.delete(c.code);
          } else {
            s.add(c.code);
          }

          updateOptionButton(
            option,
            s.has(c.code)
          );

          updateCells();
        }
      );

      list.append(option);
    }

    section.append(list);
    box.append(section);

    all.addEventListener(
      'click',
      () => {
        state.filters.set(
          d.id,
          new Set(
            categories.map(
              x => x.code
            )
          )
        );

        list
          .querySelectorAll(
            '.option'
          )
          .forEach(
            x =>
              updateOptionButton(
                x,
                true
              )
          );

        updateCells();
      }
    );

    none.addEventListener(
      'click',
      () => {
        state.filters.set(
          d.id,
          new Set()
        );

        list
          .querySelectorAll(
            '.option'
          )
          .forEach(
            x =>
              updateOptionButton(
                x,
                false
              )
          );

        updateCells();
      }
    );
  }

  updateCells();
}

function updateOptionButton(
  option,
  selected
) {
  option.classList.toggle(
    'selected',
    selected
  );

  option.setAttribute(
    'aria-pressed',
    selected
      ? 'true'
      : 'false'
  );
}

function selectedFilters() {
  const q = {};

  const allDimensions =
    state.metadata
      ? dimensions(
          state.metadata
        )
      : [];

  const categoriesById =
    new Map(
      allDimensions.map(
        d => [
          d.id,
          d.categories
        ]
      )
    );

  for (
    const [id, set] of
    state.filters
  ) {
    const categories =
      categoriesById.get(id) ||
      [];

    if (set.size === 0) {
      continue;
    }

    if (
      categories.length > 0 &&
      set.size === categories.length
    ) {
      continue;
    }

    q[id] = [...set];
  }

  return q;
}

function cellCount() {
  let n = 1;

  for (
    const set of
    state.filters.values()
  ) {
    n *= set.size;
  }

  return n;
}

function updateCells() {
  const n =
    cellCount();

  const bad =
    n > MAX_CELLS ||
    [...state.filters.values()]
      .some(
        s => s.size === 0
      );

  $('cellInfo').hidden =
    false;

  $('cellInfo').innerHTML =
    `<strong>Nombre de cel·les de la taula filtrada:</strong> ${n.toLocaleString('ca-ES')} · <span class="${bad ? 'bad' : 'ok'}">${[...state.filters.values()].some(s => s.size === 0) ? 'Cal seleccionar almenys un valor per cada dimensió.' : bad ? 'L’API no accepta més de 20.000 cel·les. Cal filtrar la taula.' : 'Es pot continuar sense filtrar més la taula.'}</span>`;

  document
    .querySelectorAll(
      '.filter'
    )
    .forEach(f => {
      const n2 =
        state.filters
          .get(
            f.dataset.dim
          )
          ?.size || 0;

      f.querySelector(
        '.selected-count'
      ).textContent =
        `${n2.toLocaleString('ca-ES')} seleccionades`;
    });

  $('query').disabled =
    bad ||
    !state.metadata;
}

function buildParams() {
  const p =
    new URLSearchParams();

  for (
    const [k, v] of
    Object.entries(
      selectedFilters()
    )
  ) {
    p.set(
      k,
      v.join(',')
    );
  }

  p.set(
    'lang',
    'ca'
  );

  return p;
}


/* =====================================================
   CONSULTA
   ===================================================== */

async function runQuery() {
  const token =
    ++state.requestToken;

  setBusy(true);

  $('query').disabled =
    true;

  status(
    'Consultant l’API…'
  );

  try {
    const params =
      buildParams();

    const base =
      currentPath() + '/data';

    const getUrl =
      base +
      '?' +
      params.toString();

    let ds;

    if (
      getUrl.length <= 2000
    ) {
      ds =
        await fetchJson(
          getUrl
        );
    } else {
      ds =
        await fetchJson(
          base,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/x-www-form-urlencoded'
            },
            body:
              params.toString()
          }
        );
    }

    if (
      token !== state.requestToken
    ) {
      return;
    }

    state.lastData =
      ds;

    state.lastQueryUrl =
      getUrl;

    state.page = 1;

    renderResults(ds);

    $('exportCsv').disabled =
      false;

    $('exportXlsx').disabled =
      false;

    status(
      `${(ds.value || []).length.toLocaleString('ca-ES')} valors retornats`,
      'ok'
    );

    updateUrl(true);

  } catch (e) {
    if (
      token === state.requestToken
    ) {
      $('results').innerHTML =
        `<div class="error">${esc(e.message)}</div>`;

      status(
        'Error',
        'error'
      );
    }

  } finally {
    setBusy(false);
    updateCells();
  }
}


/* =====================================================
   RESULTATS
   ===================================================== */

function resultRows(ds) {
  const ids =
    ds.id || [];

  const sizes =
    ds.size || [];

  const dims =
    ids.map(id => ({
      id,
      label:
        ds.dimension[id]?.label ||
        id,
      cats:
        jsonstatCategories(
          ds,
          id
        )
    }));

  /*
   * JSON-stat pot representar "value" com:
   *
   *   [12, 15, 20, ...]
   *
   * o com un objecte sparse:
   *
   *   {"0": 12, "1": 15, "7": 20}
   *
   * Normalitzem els dos casos.
   */

  const values =
    ds.value ?? [];

  function getValue(flat) {
    if (
      Array.isArray(values)
    ) {
      return values[flat];
    }

    if (
      values &&
      typeof values === 'object'
    ) {
      return values[String(flat)];
    }

    return undefined;
  }

  /*
   * Nombre total de cel·les.
   *
   * No podem utilitzar values.length perquè
   * en un JSON-stat sparse pot ser un objecte.
   */

  const totalCells =
    sizes.reduce(
      (a, b) => a * b,
      1
    );

  const rows = [];

  /*
   * Important:
   *
   * Recorrem totes les posicions del producte
   * cartesià definit per "size", no només les
   * posicions que tinguin un valor explícit.
   *
   * Això conserva també les cel·les amb valor null.
   */

  for (
    let flat = 0;
    flat < totalCells;
    flat++
  ) {
    let rem = flat;

    const row = {};

    for (
      let j = ids.length - 1;
      j >= 0;
      j--
    ) {
      const size =
        Number(
          sizes[j] || 0
        );

      if (!size) {
        continue;
      }

      const idx =
        rem % size;

      rem =
        Math.floor(
          rem / size
        );

      const cats =
        dims[j].cats;

      /*
       * Busquem la categoria per la seva
       * posició JSON-stat original.
       *
       * Això és important quan category.index
       * no coincideix simplement amb la posició
       * de l'array resultant.
       */

      const c =
        cats.find(
          x => x.index === idx
        );

      row[ids[j]] = {
        code:
          c?.code ?? '',
        label:
          c?.label ?? ''
      };
    }

    row.value =
      getValue(flat);

    rows.push(row);
  }
            console.log(
              'DIMENSIONS JSON-STAT:',
              dims
            );
            
            console.log(
              'RIPOLLÈS:',
              rows.filter(
                r =>
                  r.com?.code === '31'
              )
            );
            console.log(
            'COM categories:',
            dims
              .find(d => d.id === 'COM')
              ?.cats
          );
          
          console.log(
            'COM 31:',
            dims
              .find(d => d.id === 'COM')
              ?.cats
              .find(c => c.code === '31')
          );
  
  return {
    ids,
    dims,
    rows:
      sortRowsTerritorially(
        rows,
        dims
      )
  };
}

function renderResults(ds) {
  const {
    ids,
    dims,
    rows
  } = resultRows(ds);

  state.pivot.rows = [];
  state.pivot.columns = [];

  const start =
    (state.page - 1) *
    state.pageSize;

  const end =
    Math.min(
      start + state.pageSize,
      rows.length
    );

  const pageRows =
    rows.slice(
      start,
      end
    );

  const headers =
    dims
      .flatMap(
        d => [
          `${d.id}_Codi`,
          `${d.id}_Etiqueta`
        ]
      )
      .concat('Valor');

  let html =
    `<div class="result-meta">${rows.length.toLocaleString('ca-ES')} files · mostrant ${rows.length ? start + 1 : 0}–${end}</div><div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>`;

  for (
    const row of pageRows
  ) {
    html += '<tr>';

    for (
      const d of dims
    ) {
      html +=
        `<td>${esc(row[d.id].code)}</td><td>${esc(row[d.id].label)}</td>`;
    }

    const v =
      row.value;

    html +=
      `<td class="num">${v === null || v === undefined ? '' : esc(formatValue(v))}</td>`;

    html += '</tr>';
  }

  html +=
    '</tbody></table></div>';

  const pages =
    Math.max(
      1,
      Math.ceil(
        rows.length /
        state.pageSize
      )
    );

  html +=
    `<div class="pager"><button class="secondary" id="prevPage" ${state.page <= 1 ? 'disabled' : ''}>Anterior</button><span>Pàgina ${state.page} / ${pages}</span><button class="secondary" id="nextPage" ${state.page >= pages ? 'disabled' : ''}>Següent</button><select id="pageSize"><option ${state.pageSize === 50 ? 'selected' : ''}>50</option><option ${state.pageSize === 100 ? 'selected' : ''}>100</option><option ${state.pageSize === 250 ? 'selected' : ''}>250</option></select></div>`;

  $('results').innerHTML =
    html;

  $('prevPage').onclick =
    () => {
      state.page--;
      renderResults(ds);
    };

  $('nextPage').onclick =
    () => {
      state.page++;
      renderResults(ds);
    };

  $('pageSize').onchange =
    e => {
      state.pageSize =
        +e.target.value;

      state.page = 1;

      renderResults(ds);
    };

  renderPivotBuilder();
}

function formatValue(v) {
  return typeof v === 'number'
    ? v.toLocaleString(
        'ca-ES',
        {
          maximumFractionDigits:
            20
        }
      )
    : v;
}


/* =====================================================
   CONSTRUCTOR DE TAULES
   ===================================================== */

function pivotDimensionLabel(
  dim
) {
  return (
    dim?.label ||
    dim?.id ||
    ''
  );
}

function pivotDimensionById(
  dims,
  id
) {
  return dims.find(
    d => d.id === id
  );
}

function isConceptDimension(
  dim
) {
  return (
    String(
      dim?.label || ''
    )
      .trim()
      .toLowerCase() ===
    'concepte'
  );
}

function pivotAvailableDimensions(
  dims
) {
  const used =
    new Set([
      ...state.pivot.rows,
      ...state.pivot.columns
    ]);

  return dims.filter(
    d =>
      !isConceptDimension(d) &&
      !used.has(d.id)
  );
}

function pivotMoveDimension(
  id,
  target
) {
  state.pivot.rows =
    state.pivot.rows.filter(
      x => x !== id
    );

  state.pivot.columns =
    state.pivot.columns.filter(
      x => x !== id
    );

  if (
    target === 'rows'
  ) {
    state.pivot.rows.push(id);
  }

  if (
    target === 'columns'
  ) {
    state.pivot.columns.push(id);
  }

  renderPivotBuilder();
}

function pivotRemoveDimension(
  id
) {
  state.pivot.rows =
    state.pivot.rows.filter(
      x => x !== id
    );

  state.pivot.columns =
    state.pivot.columns.filter(
      x => x !== id
    );

  renderPivotBuilder();
}

function pivotDragStart(
  event,
  id
) {
  event.dataTransfer.setData(
    'text/plain',
    id
  );

  event.dataTransfer.effectAllowed =
    'move';
}

function pivotAllowDrop(
  event
) {
  event.preventDefault();

  event.dataTransfer.dropEffect =
    'move';
}

function pivotDrop(
  event,
  target
) {
  event.preventDefault();

  const id =
    event.dataTransfer.getData(
      'text/plain'
    );

  if (!id) {
    return;
  }

  pivotMoveDimension(
    id,
    target
  );
}

function pivotDropOnItem(
  event,
  target,
  targetId
) {
  event.preventDefault();
  event.stopPropagation();

  const id =
    event.dataTransfer.getData(
      'text/plain'
    );

  if (
    !id ||
    id === targetId
  ) {
    return;
  }

  state.pivot.rows =
    state.pivot.rows.filter(
      x => x !== id
    );

  state.pivot.columns =
    state.pivot.columns.filter(
      x => x !== id
    );

  const targetList =
    target === 'rows'
      ? state.pivot.rows
      : state.pivot.columns;

  const index =
    targetList.indexOf(
      targetId
    );

  targetList.splice(
    index < 0
      ? targetList.length
      : index,
    0,
    id
  );

  renderPivotBuilder();
}

function pivotZoneHtml(
  title,
  zone,
  ids,
  dims
) {
  const items =
    ids.map(id => {
      const dim =
        pivotDimensionById(
          dims,
          id
        );

      return `
        <div
          class="pivot-dimension"
          draggable="true"
          data-pivot-id="${esc(id)}"
          ondragstart="pivotDragStart(event,'${esc(id)}')"
          ondragover="pivotAllowDrop(event)"
          ondrop="pivotDropOnItem(event,'${zone}','${esc(id)}')"
        >
          <span class="pivot-drag">☷</span>
          <span>${esc(pivotDimensionLabel(dim))}</span>
          <button
            type="button"
            class="pivot-remove"
            onclick="pivotRemoveDimension('${esc(id)}')"
            title="Treure"
          >×</button>
        </div>
      `;
    })
    .join('');

  return `
    <div class="pivot-zone">
      <div class="pivot-zone-title">
        ${esc(title)}
      </div>

      <div
        class="pivot-dropzone ${ids.length ? 'has-items' : ''}"
        data-pivot-zone="${zone}"
        ondragover="pivotAllowDrop(event)"
        ondrop="pivotDrop(event,'${zone}')"
      >
        ${
          items ||
          `<span class="pivot-placeholder">Arrossega variables aquí</span>`
        }
      </div>
    </div>
  `;
}

function renderPivotBuilder() {
  const builder =
    $('pivotBuilder');

  if (!state.lastData) {
    builder.innerHTML =
      '<div class="empty">Primer fes una consulta.</div>';

    return;
  }

  const {
    dims
  } =
    resultRows(
      state.lastData
    );

  const pivotDims =
    dims.filter(
      d => !isConceptDimension(d)
    );

  const available =
    pivotAvailableDimensions(
      pivotDims
    );

  const availableHtml =
    available.length
      ? available
          .map(
            d => `
              <div
                class="pivot-dimension available"
                draggable="true"
                data-pivot-id="${esc(d.id)}"
                ondragstart="pivotDragStart(event,'${esc(d.id)}')"
              >
                <span class="pivot-drag">☷</span>
                <span>${esc(pivotDimensionLabel(d))}</span>
              </div>
            `
          )
          .join('')
      : '<span class="pivot-placeholder">Totes les variables estan assignades.</span>';

  const rowsValid =
    state.pivot.rows.length >
    0;

  const columnsValid =
    state.pivot.columns.length >
    0;

  const allAssigned =
    state.pivot.rows.length +
      state.pivot.columns.length ===
    pivotDims.length;

  builder.innerHTML = `
    <div class="pivot-intro">
      <strong>Constructor de taula</strong>
      <span>
        Arrossega cada variable a Files o Columnes. Pots canviar-ne l'ordre.
      </span>
    </div>

    <div class="pivot-layout">

      <div class="pivot-panel">
        <div class="pivot-panel-title">
          Variables disponibles
        </div>

        <div class="pivot-available">
          ${availableHtml}
        </div>
      </div>

      <div class="pivot-panel">
        ${pivotZoneHtml(
          'Files',
          'rows',
          state.pivot.rows,
          dims
        )}
      </div>

      <div class="pivot-panel">
        ${pivotZoneHtml(
          'Columnes',
          'columns',
          state.pivot.columns,
          dims
        )}
      </div>

    </div>

    <div class="pivot-actions">

      <button
        id="pivotBuild"
        class="primary"
        ${
          allAssigned &&
          rowsValid &&
          columnsValid
            ? ''
            : 'disabled'
        }
      >
        Genera la taula
      </button>

      <button
        id="pivotReset"
        class="secondary"
      >
        Restableix
      </button>

      <span class="pivot-help">
        ${
          !allAssigned
            ? 'Assigna totes les variables a Files o Columnes.'
            : !rowsValid ||
              !columnsValid
              ? 'Cal tenir almenys una variable a Files i una a Columnes.'
              : 'Configuració correcta.'
        }
      </span>

    </div>

    <div id="pivotResult"></div>
  `;

  $('pivotBuild').onclick =
    () => renderPivotTable();

  $('pivotReset').onclick =
    () => {
      state.pivot.rows = [];
      state.pivot.columns = [];

      renderPivotBuilder();
    };
}

function pivotKey(
  row,
  ids
) {
  return ids
    .map(
      id =>
        row[id]?.code ?? ''
    )
    .join('¦');
}

function pivotLabel(
  row,
  ids
) {
  return ids
    .map(
      id =>
        row[id]?.label ?? ''
    )
    .join(' · ');
}

function pivotCombinationMap(
  rows,
  ids,
  dimsOverride = null
) {
  const map =
    new Map();

  for (
    const row of rows
  ) {
    const key =
      pivotKey(
        row,
        ids
      );

    map.set(
      key,
      {
        key,
        label:
          pivotLabel(
            row,
            ids
          ),
        row
      }
    );
  }

  const dims =
    dimsOverride ||
    resultRows(
      state.lastData
    ).dims;

  const result =
    [...map.values()];

  return result.sort(
    (a, b) => {
      for (
        const id of ids
      ) {
        const dim =
          pivotDimensionById(
            dims,
            id
          );

        if (
          !isTerritorialDimension(
            dim
          )
        ) {
          continue;
        }

        const ac =
          String(
            a.row[id]?.code ?? ''
          );

        const bc =
          String(
            b.row[id]?.code ?? ''
          );

        const ao =
          territorialSortOrder(
            dim,
            ac
          );

        const bo =
          territorialSortOrder(
            dim,
            bc
          );

        if (ao !== bo) {
          return ao - bo;
        }

        if (ac !== bc) {
          return ac.localeCompare(
            bc,
            'ca',
            { numeric: true }
          );
        }
      }

      return 0;
    }
  );
}

function renderPivotTable() {
  const result =
    $('pivotResult');

  if (!state.lastData) {
    return;
  }

  const {
    dims,
    rows
  } =
    resultRows(
      state.lastData
    );

  const pivotDims =
    dims.filter(
      d => !isConceptDimension(d)
    );

  const rowIds =
    state.pivot.rows;

  const columnIds =
    state.pivot.columns;

  if (
    !rowIds.length ||
    !columnIds.length
  ) {
    result.innerHTML =
      `<div class="error">
        Cal assignar almenys una variable a Files i una a Columnes.
      </div>`;

    return;
  }

  const allIds =
    [
      ...rowIds,
      ...columnIds
    ];

  if (
    allIds.length !==
    new Set(allIds).size
  ) {
    result.innerHTML =
      `<div class="error">
        Una variable només pot aparèixer una vegada.
      </div>`;

    return;
  }

  if (
    allIds.length !==
    pivotDims.length
  ) {
    result.innerHTML =
      `<div class="error">
        No totes les dimensions estan assignades.
      </div>`;

    return;
  }

  const rowCombinations =
    pivotCombinationMap(
      rows,
      rowIds,
      dims
    );

  const columnCombinations =
    pivotCombinationMap(
      rows,
      columnIds,
      dims
    );

  const values =
    new Map();

  for (
    const row of rows
  ) {
    const rKey =
      pivotKey(
        row,
        rowIds
      );

    const cKey =
      pivotKey(
        row,
        columnIds
      );

    values.set(
      `${rKey}§${cKey}`,
      row.value
    );
  }

  const rowHeader =
    rowIds
      .map(id => {
        const dim =
          pivotDimensionById(
            dims,
            id
          );

        return `<th>${esc(
          pivotDimensionLabel(
            dim
          )
        )}</th>`;
      })
      .join('');

  const columnHeaders =
    columnCombinations
      .map(
        c =>
          `<th class="pivot-value-header">${esc(c.label)}</th>`
      )
      .join('');

  let html =
    `<div class="pivot-table-title">${esc(state.metadata?.label || '')}</div>
     <div class="pivot-result-meta">
       ${rowCombinations.length.toLocaleString('ca-ES')} files ·
       ${columnCombinations.length.toLocaleString('ca-ES')} columnes
     </div>

     <div class="table-wrap pivot-table-wrap">
       <table class="data-table pivot-table">
         <thead>
           <tr>
             ${rowHeader}
             ${columnHeaders}
           </tr>
         </thead>
         <tbody>`;

  for (
    const r of rowCombinations
  ) {
    html += '<tr>';

    for (
      const id of rowIds
    ) {
      html +=
        `<td class="pivot-label">${esc(r.row[id]?.label ?? '')}</td>`;
    }

    for (
      const c of columnCombinations
    ) {
      const value =
        values.get(
          `${r.key}§${c.key}`
        );

      html +=
        `<td class="num pivot-cell">${
          value === null ||
          value === undefined
            ? ''
            : esc(formatValue(value))
        }</td>`;
    }

    html += '</tr>';
  }

  html +=
    `</tbody>
       </table>
     </div>`;

  result.innerHTML =
    html;
}


/* =====================================================
   EXPORTACIÓ
   ===================================================== */

function exportInfo() {
  const tableName =
    state.metadata?.label ||
    $('tableInfo')
      .querySelector(
        'strong'
      )
      ?.nextSibling
      ?.textContent
      ?.trim() ||
    `Taula ${state.selected.table}`;

  const queryUrl =
    state.lastQueryUrl ||
    (
      currentPath() +
      '/data?' +
      buildParams().toString()
    );

  const now =
    new Date();

  const pad =
    n =>
      String(n).padStart(
        2,
        '0'
      );

  const exportDate =
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return {
    tableName,
    queryUrl,
    exportDate
  };
}

function exportCSV() {
  if (!state.lastData) {
    return;
  }

  const {
    dims,
    rows
  } =
    resultRows(
      state.lastData
    );

  const headers =
    dims
      .flatMap(
        d => [
          `${d.id}_Codi`,
          `${d.id}_Etiqueta`
        ]
      )
      .concat('Valor');

  const {
    tableName,
    queryUrl,
    exportDate
  } =
    exportInfo();

  const out = [
    [tableName],
    [`URL: ${queryUrl}`],
    [`Data de consulta: ${exportDate}`],
    [],
    headers
  ];

  for (
    const r of rows
  ) {
    out.push(
      dims
        .flatMap(
          d => [
            r[d.id].code,
            r[d.id].label
          ]
        )
        .concat(
          r.value ?? ''
        )
    );
  }

  const csv =
    '\ufeff' +
    out
      .map(
        row =>
          row
            .map(
              v =>
                '"' +
                String(
                  v ?? ''
                ).replace(
                  /"/g,
                  '""'
                ) +
                '"'
            )
            .join(';')
      )
      .join('\r\n');

  const blob =
    new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const a =
    document.createElement(
      'a'
    );

  a.href = url;

  a.download =
    `idescat_${state.selected.stat}_${state.selected.table}_${state.selected.geo}.csv`;

  a.click();

  URL.revokeObjectURL(
    url
  );
}

function buildPivotExportData() {
  if (!state.lastData) {
    return null;
  }

  const {
    dims,
    rows
  } =
    resultRows(
      state.lastData
    );

  const pivotDims =
    dims.filter(
      d => !isConceptDimension(d)
    );

  const rowIds =
    state.pivot.rows;

  const columnIds =
    state.pivot.columns;

  if (
    !rowIds.length ||
    !columnIds.length
  ) {
    return null;
  }

  const allIds =
    [
      ...rowIds,
      ...columnIds
    ];

  if (
    allIds.length !==
      pivotDims.length ||
    allIds.length !==
      new Set(allIds).size
  ) {
    return null;
  }

  const rowCombinations =
    pivotCombinationMap(
      rows,
      rowIds,
      dims
    );

  const columnCombinations =
    pivotCombinationMap(
      rows,
      columnIds,
      dims
    );

  const values =
    new Map();

  for (
    const row of rows
  ) {
    const rKey =
      pivotKey(
        row,
        rowIds
      );

    const cKey =
      pivotKey(
        row,
        columnIds
      );

    values.set(
      `${rKey}§${cKey}`,
      row.value
    );
  }

  const out = [];

  out.push([
    state.metadata?.label ||
      ''
  ]);

  out.push([
    `Files: ${rowCombinations.length} · Columnes: ${columnCombinations.length}`
  ]);

  out.push([]);

  const header = [];

  for (
    const id of rowIds
  ) {
    header.push(
      pivotDimensionLabel(
        pivotDimensionById(
          dims,
          id
        )
      )
    );
  }

  for (
    const c of columnCombinations
  ) {
    header.push(
      c.label
    );
  }

  out.push(header);

  for (
    const r of rowCombinations
  ) {
    const rowOut = [];

    for (
      const id of rowIds
    ) {
      rowOut.push(
        r.row[id]?.label ?? ''
      );
    }

    for (
      const c of columnCombinations
    ) {
      const value =
        values.get(
          `${r.key}§${c.key}`
        );

      rowOut.push(
        value === null ||
        value === undefined
          ? ''
          : value
      );
    }

    out.push(rowOut);
  }

  return out;
}

function exportXLSX() {
  if (!state.lastData) {
    return;
  }

  if (
    typeof XLSX === 'undefined'
  ) {
    status(
      "No s'ha pogut carregar el mòdul d'exportació XLSX.",
      'error'
    );

    return;
  }

  const {
    dims,
    rows
  } =
    resultRows(
      state.lastData
    );

  const headers =
    dims
      .flatMap(
        d => [
          `${d.id}_Codi`,
          `${d.id}_Etiqueta`
        ]
      )
      .concat('Valor');

  const {
    tableName,
    queryUrl,
    exportDate
  } =
    exportInfo();

  /* ---------- Full Dades ---------- */

  const out = [
    [tableName],
    [`URL: ${queryUrl}`],
    [`Data de consulta: ${exportDate}`],
    [],
    headers
  ];

  for (
    const r of rows
  ) {
    out.push(
      dims
        .flatMap(
          d => [
            r[d.id].code,
            r[d.id].label
          ]
        )
        .concat(
          r.value ?? ''
        )
    );
  }

  const ws =
    XLSX.utils.aoa_to_sheet(
      out
    );

  ws['!autofilter'] = {
    ref:
      XLSX.utils.encode_range({
        s: {
          r: 4,
          c: 0
        },
        e: {
          r:
            out.length - 1,
          c:
            headers.length - 1
        }
      })
  };

  ws['!merges'] = [
    {
      s: {
        r: 0,
        c: 0
      },
      e: {
        r: 0,
        c:
          Math.max(
            0,
            headers.length - 1
          )
      }
    },
    {
      s: {
        r: 1,
        c: 0
      },
      e: {
        r: 1,
        c:
          Math.max(
            0,
            headers.length - 1
          )
      }
    },
    {
      s: {
        r: 2,
        c: 0
      },
      e: {
        r: 2,
        c:
          Math.max(
            0,
            headers.length - 1
          )
      }
    }
  ];

  if (ws['A1']) {
    ws['A1'].s = {
      font: {
        bold: true
      }
    };
  }

  /* ---------- Llibre ---------- */

  const wb =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    'Dades'
  );

  /* ---------- Full Taula construïda ---------- */

  const pivotOut =
    buildPivotExportData();

  if (pivotOut) {
    const pivotWs =
      XLSX.utils.aoa_to_sheet(
        pivotOut
      );

    const width =
      pivotOut[3]?.length ||
      1;

    pivotWs['!merges'] = [
      {
        s: {
          r: 0,
          c: 0
        },
        e: {
          r: 0,
          c:
            Math.max(
              0,
              width - 1
            )
        }
      },
      {
        s: {
          r: 1,
          c: 0
        },
        e: {
          r: 1,
          c:
            Math.max(
              0,
              width - 1
            )
        }
      }
    ];

    if (
      pivotOut.length > 4
    ) {
      pivotWs['!autofilter'] = {
        ref:
          XLSX.utils.encode_range({
            s: {
              r: 3,
              c: 0
            },
            e: {
              r:
                pivotOut.length - 1,
              c:
                width - 1
            }
          })
      };
    }

    if (
      pivotWs['A1']
    ) {
      pivotWs['A1'].s = {
        font: {
          bold: true
        }
      };
    }

    XLSX.utils.book_append_sheet(
      wb,
      pivotWs,
      'Taula construïda'
    );
  }

  XLSX.writeFile(
    wb,
    `idescat_${state.selected.stat}_${state.selected.table}_${state.selected.geo}.xlsx`
  );
}


/* =====================================================
   URL
   ===================================================== */

function updateUrl(
  withFilters = false
) {
  const p =
    new URLSearchParams();

  for (
    const [k, v] of
    Object.entries(
      state.selected
    )
  ) {
    if (v) {
      p.set(k, v);
    }
  }

  if (withFilters) {
    for (
      const [k, v] of
      Object.entries(
        selectedFilters()
      )
    ) {
      p.set(
        k,
        v.join(',')
      );
    }
  }

  history.replaceState(
    null,
    '',
    '?' + p.toString()
  );
}


/* =====================================================
   EVENTS
   ===================================================== */

function bind() {
  $('stat').onchange =
    onStatChange;

  $('node').onchange =
    onNodeChange;

  $('table').onchange =
    onTableChange;

  $('geo').onchange =
    onGeoChange;

  $('concept').onchange =
    async () => {
      state.selected.concept =
        $('concept').value;

      state.selected.cross =
        '';

      resetBelow(
        'concept'
      );

      if (
        state.selected.concept
      ) {
        await updateCrossOptions();
      }
    };

  $('cross').onchange =
    async () => {
      state.selected.cross =
        $('cross').value;

      resetBelow(
        'cross'
      );

      if (
        state.selected.concept
      ) {
        await loadNodesForSelection();
      }
    };

  $('query').onclick =
    runQuery;

  $('exportCsv').onclick =
    exportCSV;

  $('exportXlsx').onclick =
    exportXLSX;

  $('tabData').onclick =
    () => {
      $('tabData')
        .classList.add(
          'active'
        );

      $('tabPivot')
        .classList.remove(
          'active'
        );

      $('results').hidden =
        false;

      $('pivotBuilder').hidden =
        true;
    };

  $('tabPivot').onclick =
    () => {
      $('tabPivot')
        .classList.add(
          'active'
        );

      $('tabData')
        .classList.remove(
          'active'
        );

      $('results').hidden =
        true;

      $('pivotBuilder').hidden =
        false;

      if (
        state.lastData
      ) {
        renderPivotBuilder();
      }
    };

  $('clear').onclick =
    () => {
      state.filters.clear();

      state.lastData =
        null;

      state.pivot.rows =
        [];

      state.pivot.columns =
        [];

      $('results').innerHTML =
        '';

      $('pivotBuilder').innerHTML =
        '';

      $('exportCsv').disabled =
        true;

      $('exportXlsx').disabled =
        true;

      if (
        state.metadata
      ) {
        renderMetadata(
          state.metadata
        );
      }
    };
}


/* =====================================================
   INICI
   ===================================================== */

(async function init() {
  bind();

  try {
    await loadStats();
  } catch (e) {
    status(
      e.message,
      'error'
    );
  }
})();
