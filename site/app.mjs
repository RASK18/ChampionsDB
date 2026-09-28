import { Database } from "./loader.mjs";
import {
  titles,
  defaults,
  operators,
  opLabels,
  translate,
  pathLabel,
  collections,
  referenceCollection,
} from "./catalog.mjs";
import {
  queryRows,
  relationDefs,
  relationLabels,
  displayValue,
  fieldValue,
  undecided,
  referenceText,
} from "./engine.mjs";
const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else if (key === "checked") node.checked = value;
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat())
    if (child !== undefined && child !== null)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return node;
};
const button = (text, fn, attrs = {}) =>
  el("button", { type: "button", onclick: fn, ...attrs }, text);
const option = (value, label) => el("option", { value }, label);
function select(entries, value, change, attrs = {}) {
  const node = el(
    "select",
    attrs,
    entries.map(([v, label]) => option(v, label)),
  );
  node.value = String(value);
  node.addEventListener("change", () => change(node.value));
  return node;
}
const clone = (value) => structuredClone(value);
const group = () => ({ kind: "group", mode: "all", children: [] });
const states = new Map();
let current = "pokemon",
  database,
  graph,
  mode = "quick",
  filterOpen = innerWidth > 700,
  request = 0,
  searchTimer,
  detailRequest = 0,
  lastFocus;
function newState(c) {
  return {
    query: group(),
    search: "",
    columns: [...(defaults[c] || ["name"])],
    sort: [
      c === "pokemon"
        ? {
            relation: "species",
            field: "nationalDex",
            aggregate: "min",
            direction: "asc",
          }
        : { field: defaults[c]?.[0] || "name", direction: "asc" },
    ],
    page: 1,
    size: 50,
    bucket: "confirmed",
    matrix: false,
  };
}
function state() {
  if (!states.has(current)) states.set(current, newState(current));
  return states.get(current);
}
function label(c, id) {
  const row = graph?.maps[c]?.get(id);
  return row?.name || id;
}
function field(c, path) {
  return (
    database.catalog[c].find((f) => f.path === path) || {
      path,
      label: pathLabel(path),
      type: "enum",
      options: [],
    }
  );
}
function pretty(value) {
  return displayValue(value, graph);
}
function optionName(c, path, value) {
  const row = database.data[c]?.find((r) =>
    path === "rule.target.id"
      ? r.rule?.target?.id === value
      : path === "rule.source.id"
        ? r.rule?.source?.id === value
        : false,
  );
  const ref = referenceCollection(row, path);
  return ref ? referenceText(ref, value, graph) : pretty(value);
}
function name(c, row) {
  if (row.name) return row.name;
  if (c === "learnsets")
    return `${label("pokemon", row.pokemonId)} → ${label("moves", row.moveId)}`;
  if (c === "interactions")
    return `${pretty(row.rule.source.id || row.rule.source.selector)} · ${translate(row.rule.relation)}`;
  return `${row.id} · nombre pendiente`;
}
function fieldOptions(c) {
  return database.catalog[c].map((f) => [f.path, f.label]);
}
function safeCondition(c) {
  const f =
    database.catalog[c].find((f) => f.path === "name") ||
    database.catalog[c][0];
  return {
    kind: "condition",
    field: f.path,
    op: f.type === "text" ? "contains" : "known",
    value: "",
  };
}
function summary(n, c) {
  if (n.kind === "group") {
    if (!n.children.length) return "Sin condiciones";
    return `${n.mode === "all" ? "Todas" : n.mode === "any" ? "Alguna" : "Ninguna"}: (${n.children.map((x) => summary(x, c)).join(" · ")})`;
  }
  if (n.kind === "relation")
    return `${relationLabels[n.relation]} [${{ some: "alguno", none: "ninguno", all: "todos", count: "cantidad" }[n.quantifier]}]: ${summary(n.query, n.targetCollection || relationDefs[c][n.relation])}`;
  return `${field(c, n.field).label} ${opLabels[n.op]} ${["known", "unknown", "na"].includes(n.op) ? "" : pretty(n.value)}`;
}
function validate(n) {
  if (n.kind === "group") return n.children.every(validate);
  if (n.kind === "relation")
    return (
      validate(n.query) &&
      (n.quantifier !== "count" || (Number.isInteger(n.value) && n.value >= 0))
    );
  if (["gt", "gte", "lt", "lte"].includes(n.op))
    return Number.isFinite(n.value);
  if (n.op === "range")
    return (
      n.value.length === 2 &&
      n.value.every(Number.isFinite) &&
      n.value[0] <= n.value[1]
    );
  return !(typeof n.value === "number" && !Number.isFinite(n.value));
}
function hasRelation(n) {
  return (
    n.kind === "relation" ||
    (n.kind === "group" && n.children.some(hasRelation))
  );
}
function error(message, retry) {
  $("notice").replaceChildren(
    el("div", { class: "error" }, message, " ", button("Reintentar", retry)),
  );
}
function notice() {
  const m = database.manifest;
  const text = `Pokémon Champions ${m.context.gameVersion} · ${database.coverage.pendingCount.toLocaleString("es")} afirmaciones pendientes de verificar. La cobertura es parcial; cada campo publicado está corroborado.`;
  if ($("notice").textContent !== text) $("notice").textContent = text;
}
async function refresh() {
  const token = ++request,
    c = current,
    s = state();
  if (!validate(s.query)) {
    if (s.lastResult) renderResults(s.lastResult);
    $("results").removeAttribute("aria-busy");
    $("filter-summary").textContent =
      "Revisa los números y los límites del rango. Se conservan los últimos resultados válidos.";
    return;
  }
  $("filter-summary").textContent = summary(s.query, c);
  $("filter-count").textContent = s.query.children.length;
  $("results").setAttribute("aria-busy", "true");
  $("result-note").textContent = "Actualizando resultados…";
  try {
    await database.ensure([c]);
    if (
      ["learnsets", "interactions"].includes(c) ||
      hasRelation(s.query) ||
      s.sort.some((x) => x.relation && x.relation !== "species")
    )
      await database.relations();
    if (token !== request) return;
    graph = database.graph;
    const result = queryRows(
      database.data[c],
      c,
      s.query,
      s.search,
      s.sort,
      graph,
    );
    s.lastResult = result;
    renderResults(result);
    notice();
  } catch (e) {
    if (token === request) error(e.message, refresh);
  } finally {
    if (token === request) $("results").removeAttribute("aria-busy");
  }
}
function navigate(c) {
  current = c;
  const s = state();
  $("search").value = s.search;
  $("title").textContent = titles[c];
  $("table-wrap").replaceChildren(
    el("p", { class: "empty" }, "Cargando tabla…"),
  );
  $("pagination").replaceChildren();
  $("subtitle").textContent =
    c === "pokemon"
      ? "Una fila por forma. Explora estadísticas, habilidades y movimientos."
      : c === "regulations"
        ? "Las restricciones pendientes no implican que un Pokémon sea legal."
        : "Consulta los campos verificados y sus relaciones de combate.";
  renderNavigation();
  renderSubnav();
  renderEditor();
  renderColumns();
  renderSort();
  refresh();
}
function renderNavigation() {
  const sections = [
    "pokemon",
    "moves",
    "abilities",
    "items",
    "effects",
    "types",
    "natures",
    "battle-rules",
  ];
  $("navigation").replaceChildren(
    ...sections.map((c) =>
      button(c === "battle-rules" ? "Reglas" : titles[c], () => navigate(c), {
        "aria-current":
          c === current ||
          (c === "pokemon" && ["species", "learnsets"].includes(current)) ||
          (c === "battle-rules" &&
            ["interactions", "regulations"].includes(current))
            ? "page"
            : "false",
        class:
          c === current ||
          (c === "battle-rules" &&
            ["interactions", "regulations"].includes(current))
            ? "active"
            : "",
      }),
    ),
  );
}
function renderSubnav() {
  const nodes = [];
  if (["pokemon", "species", "learnsets"].includes(current))
    for (const c of ["pokemon", "species", "learnsets"])
      nodes.push(
        button(titles[c], () => navigate(c), {
          "aria-pressed": String(c === current),
        }),
      );
  if (["battle-rules", "interactions", "regulations"].includes(current))
    for (const c of ["battle-rules", "interactions", "regulations"])
      nodes.push(
        button(titles[c], () => navigate(c), {
          "aria-pressed": String(c === current),
        }),
      );
  if (current === "effects")
    for (const [v, l] of [
      ["", "Todos"],
      ["weather", "Climas"],
      ["terrain", "Terrenos"],
      ["status", "Estados"],
      ["volatile", "Volátiles"],
    ])
      nodes.push(
        button(l, () => {
          setQuick("category", v ? [v] : []);
          renderEditor();
          refresh();
        }),
      );
  if (current === "types")
    nodes.push(
      button(state().matrix ? "Ver tabla" : "Ver matriz", () => {
        state().matrix = !state().matrix;
        renderSubnav();
        refresh();
      }),
    );
  $("subnav").replaceChildren(...nodes);
}
function setQuick(path, value, op) {
  const s = state();
  s.query.children = s.query.children.filter((n) => n.quick !== path);
  if (value !== "" && (!Array.isArray(value) || value.length))
    s.query.children.push({
      kind: "condition",
      field: path,
      op: op || (["typeIds", "abilityIds"].includes(path) ? "some" : "in"),
      value,
      quick: path,
    });
  s.page = 1;
}
function quickEditor() {
  const c = current,
    box = el("div");
  const chosen =
    c === "pokemon"
      ? ["typeIds", "form.kind", "abilityIds", "stats.speed"]
      : c === "moves"
        ? ["typeId", "category", "power.value", "pp", "properties.contact"]
        : c === "items"
          ? ["category"]
          : c === "effects"
            ? ["category"]
            : c === "interactions"
              ? [
                  "rule.relation",
                  "rule.source.collection",
                  "rule.target.collection",
                ]
              : c === "natures"
                ? ["increased", "decreased"]
                : database.catalog[c]
                    .filter((f) => f.type === "enum")
                    .slice(0, 2)
                    .map((f) => f.path);
  for (const path of chosen) {
    const f = field(c, path),
      existing = state().query.children.find((n) => n.quick === path),
      wrap = el("div", { class: "quick-field" }, el("span", {}, f.label));
    if (f.type === "number") {
      const value = el("input", {
        type: "number",
        placeholder: "Sin límite",
        "aria-label": f.label,
        value: existing?.value ?? "",
        oninput: (e) => {
          setQuick(
            path,
            e.target.value === "" ? "" : Number(e.target.value),
            "gte",
          );
          refresh();
        },
      });
      wrap.append(el("span", { class: "help" }, "Mayor o igual a"), value);
    } else if (f.type === "boolean")
      wrap.append(
        select(
          [
            ["", "Cualquiera"],
            ["true", "Sí"],
            ["false", "No"],
          ],
          existing?.value ?? "",
          (v) => {
            setQuick(path, v === "" ? "" : v === "true", "eq");
            refresh();
          },
          { "aria-label": f.label },
        ),
      );
    else {
      const modes =
        f.type === "list"
          ? [
              ["some", "Incluye alguno"],
              ["every", "Incluye todos"],
              ["none", "Excluye todos"],
              ["exact", "Conjunto exacto"],
            ]
          : [
              ["in", "Incluir"],
              ["notIn", "Excluir"],
            ];
      let operation = existing?.op || modes[0][0];
      wrap.append(
        select(
          modes,
          operation,
          (v) => {
            operation = v;
            const active = state().query.children.find((n) => n.quick === path);
            if (active) {
              active.op = v;
              refresh();
            }
          },
          { "aria-label": `Operación de ${f.label}` },
        ),
      );
      const picker = el("details", {}, el("summary", {}, "Elegir valores"));
      const options = el("div", { class: "option-list" });
      picker.append(
        el("input", {
          type: "text",
          placeholder: "Filtrar opciones…",
          "aria-label": `Buscar opciones de ${f.label}`,
          oninput: (e) => {
            const query = e.target.value.toLocaleLowerCase("es");
            for (const child of options.children)
              child.hidden = !child.textContent
                .toLocaleLowerCase("es")
                .includes(query);
          },
        }),
      );
      const values = new Set(existing?.value || []);
      for (const v of f.options)
        options.append(
          el(
            "label",
            {},
            el("input", {
              type: "checkbox",
              checked: values.has(v),
              onchange: (e) => {
                if (e.target.checked) values.add(v);
                else values.delete(v);
                setQuick(path, [...values], operation);
                refresh();
              },
            }),
            " ",
            optionName(c, path, v),
          ),
        );
      picker.append(options);
      wrap.append(picker);
    }
    box.append(wrap);
  }
  box.append(
    button(
      "Añadir cualquier condición…",
      () => {
        mode = "advanced";
        renderEditor();
      },
      { class: "mini" },
    ),
  );
  return box;
}
function renderEditor() {
  $("quick-tab").setAttribute("aria-pressed", String(mode === "quick"));
  $("advanced-tab").setAttribute("aria-pressed", String(mode === "advanced"));
  $("filter-editor").replaceChildren(
    mode === "quick" ? quickEditor() : renderGroup(state().query, current),
  );
  $("filter-summary").textContent = summary(state().query, current);
}
function mutate() {
  state().page = 1;
  renderEditor();
  refresh();
}
function itemTools(parent, node) {
  return el(
    "div",
    { class: "clause-tools" },
    button(
      "Duplicar",
      () => {
        parent.children.splice(
          parent.children.indexOf(node) + 1,
          0,
          clone(node),
        );
        mutate();
      },
      { class: "mini" },
    ),
    button(
      "Eliminar",
      () => {
        parent.children.splice(parent.children.indexOf(node), 1);
        mutate();
      },
      { class: "mini" },
    ),
  );
}
function renderGroup(node, c, parent) {
  const box = el("div", { class: "group" });
  const head = el(
    "div",
    { class: "group-head" },
    select(
      [
        ["all", "Todas estas condiciones"],
        ["any", "Alguna de estas condiciones"],
        ["none", "Ninguna de estas condiciones"],
      ],
      node.mode,
      (v) => {
        node.mode = v;
        refresh();
      },
      { "aria-label": "Combinación del grupo" },
    ),
  );
  if (parent) head.append(itemTools(parent, node));
  box.append(head);
  for (const child of node.children)
    box.append(
      child.kind === "group"
        ? renderGroup(child, c, node)
        : child.kind === "relation"
          ? renderRelation(child, c, node)
          : renderClause(child, c, node),
    );
  const add = el(
    "div",
    { class: "add-controls" },
    button(
      "+ Condición",
      () => {
        node.children.push(safeCondition(c));
        mutate();
      },
      { class: "mini" },
    ),
    button(
      "+ Grupo",
      () => {
        node.children.push(group());
        mutate();
      },
      { class: "mini" },
    ),
  );
  const rels = Object.keys(relationDefs[c] || {});
  if (rels.length)
    add.append(
      button(
        "+ Relación",
        () => {
          const relation = rels[0];
          node.children.push({
            kind: "relation",
            relation,
            quantifier: "some",
            query: group(),
            ...(relationDefs[c][relation] === "*"
              ? { targetCollection: "moves" }
              : {}),
          });
          mutate();
        },
        { class: "mini" },
      ),
    );
  box.append(add);
  return box;
}
function renderClause(node, c, parent) {
  const f = field(c, node.field);
  const box = el("div", { class: "clause" }, itemTools(parent, node));
  if (node.field === "id") {
    box.append(
      el("span", {}, `Selección de ${node.value.length} registros vinculados`),
      el("details", {}, el("summary", {}, "Ver selección"), pretty(node.value)),
    );
    return box;
  }
  box.append(
    select(
      fieldOptions(c),
      node.field,
      (v) => {
        node.field = v;
        const next = field(c, v);
        node.op = operators[next.type][0];
        node.value =
          next.type === "number"
            ? 0
            : next.type === "boolean"
              ? true
              : ["enum", "list"].includes(next.type)
                ? []
                : "";
        delete node.quick;
        mutate();
      },
      { "aria-label": "Campo" },
    ),
  );
  const ops = [...operators[f.type], "known", "unknown", "na"];
  box.append(
    select(
      ops.map((v) => [v, opLabels[v]]),
      node.op,
      (v) => {
        node.op = v;
        node.value =
          v === "range"
            ? [0, 100]
            : ["in", "notIn", "some", "every", "none", "exact"].includes(v)
              ? []
              : f.type === "number"
                ? 0
                : f.type === "boolean"
                  ? true
                  : "";
        mutate();
      },
      { "aria-label": "Operador" },
    ),
  );
  if (["known", "unknown", "na"].includes(node.op)) return box;
  if (node.op === "range") {
    const inputs = el("div", { class: "quick-pair" });
    for (let i = 0; i < 2; i++)
      inputs.append(
        el("input", {
          type: "number",
          value: node.value[i],
          "aria-label": i ? "Máximo" : "Mínimo",
          oninput: (e) => {
            node.value[i] =
              e.target.value === "" ? NaN : Number(e.target.value);
            refresh();
          },
        }),
      );
    box.append(inputs);
  } else if (f.type === "boolean")
    box.append(
      select(
        [
          ["true", "Sí"],
          ["false", "No"],
        ],
        node.value,
        (v) => {
          node.value = v === "true";
          refresh();
        },
        { "aria-label": "Valor" },
      ),
    );
  else if (
    ["in", "notIn", "some", "every", "none", "exact"].includes(node.op)
  ) {
    const picker = el(
      "select",
      {
        multiple: "",
        size: Math.min(5, Math.max(2, f.options.length)),
        "aria-label": "Valores (selección múltiple)",
        onchange: (e) => {
          node.value = [...e.target.selectedOptions].map(
            (o) => f.options[Number(o.value)],
          );
          refresh();
        },
      },
      f.options.map((v, index) => option(index, optionName(c, node.field, v))),
    );
    for (const o of picker.options)
      o.selected = node.value.some(
        (v) => JSON.stringify(v) === JSON.stringify(f.options[Number(o.value)]),
      );
    box.append(
      picker,
      el("span", { class: "muted" }, "Ctrl / ⌘ para elegir varios valores."),
    );
  } else
    box.append(
      el("input", {
        type: f.type === "number" ? "number" : "text",
        value: node.value,
        "aria-label": "Valor",
        oninput: (e) => {
          node.value =
            f.type === "number"
              ? e.target.value === ""
                ? NaN
                : Number(e.target.value)
              : e.target.value;
          clearTimeout(searchTimer);
          searchTimer = setTimeout(refresh, 150);
        },
      }),
    );
  return box;
}
function renderRelation(node, c, parent) {
  const box = el("div", { class: "relation" }, itemTools(parent, node));
  box.append(
    el("label", {}, "Condiciones sobre el mismo elemento relacionado"),
    select(
      Object.keys(relationDefs[c]).map((r) => [r, relationLabels[r]]),
      node.relation,
      (v) => {
        node.relation = v;
        node.query = group();
        delete node.targetCollection;
        if (relationDefs[c][v] === "*") node.targetCollection = "moves";
        mutate();
      },
      { "aria-label": "Relación" },
    ),
  );
  let target = relationDefs[c][node.relation];
  if (target === "*") {
    target = node.targetCollection;
    box.append(
      select(
        collections.map((c) => [c, titles[c]]),
        target,
        (v) => {
          node.targetCollection = v;
          node.query = group();
          mutate();
        },
        { "aria-label": "Colección relacionada" },
      ),
    );
  }
  box.append(
    select(
      [
        ["some", "Algún elemento cumple"],
        ["none", "Ninguno cumple"],
        ["all", "Todos cumplen (al menos uno)"],
        ["count", "Cantidad que cumple"],
      ],
      node.quantifier,
      (v) => {
        node.quantifier = v;
        node.op = "gte";
        node.value = 1;
        mutate();
      },
      { "aria-label": "Cuantificador" },
    ),
  );
  if (node.quantifier === "count")
    box.append(
      select(
        ["eq", "ne", "gte", "lte", "gt", "lt"].map((v) => [v, opLabels[v]]),
        node.op,
        (v) => {
          node.op = v;
          refresh();
        },
        { "aria-label": "Comparación de cantidad" },
      ),
      el("input", {
        type: "number",
        min: 0,
        value: node.value,
        "aria-label": "Cantidad",
        oninput: (e) => {
          node.value = e.target.value === "" ? NaN : Number(e.target.value);
          refresh();
        },
      }),
    );
  if (node.relation === "producers")
    box.append(
      el(
        "label",
        {},
        el("input", {
          type: "checkbox",
          checked: node.includeIndirect,
          onchange: (e) => {
            node.includeIndirect = e.target.checked;
            refresh();
          },
        }),
        " Incluir rutas indirectas condicionadas",
      ),
    );
  box.append(renderGroup(node.query, target));
  return box;
}
function renderColumns() {
  const s = state();
  const fields = database.catalog[current];
  $("columns-panel").replaceChildren(
    el("strong", {}, "Columnas visibles"),
    el(
      "div",
      { class: "columns-grid" },
      fields.map((f) =>
        el(
          "label",
          {},
          el("input", {
            type: "checkbox",
            checked: s.columns.includes(f.path),
            disabled: f.path === "name" ? "" : undefined,
            onchange: (e) => {
              if (e.target.checked) s.columns.push(f.path);
              else s.columns = s.columns.filter((p) => p !== f.path);
              refresh();
            },
          }),
          f.path === "name" ? "Nombre (fijo)" : f.label,
        ),
      ),
    ),
  );
}
function sortOptions() {
  const c = current,
    opts = fieldOptions(c).map(([v, l]) => [JSON.stringify({ field: v }), l]);
  for (const f of database.catalog[c].filter((f) => f.type === "list"))
    opts.push([
      JSON.stringify({ field: f.path, aggregate: "count" }),
      `${f.label} · cantidad`,
    ]);
  for (const [relation, target] of Object.entries(relationDefs[c])) {
    if (target === "*") continue;
    opts.push([
      JSON.stringify({ relation, aggregate: "count" }),
      `${relationLabels[relation]} · cantidad conocida`,
    ]);
    for (const f of database.catalog[target].filter((f) => f.type === "number"))
      for (const aggregate of ["min", "max"])
        opts.push([
          JSON.stringify({ relation, field: f.path, aggregate }),
          `${relationLabels[relation]} · ${f.label} · ${aggregate === "min" ? "mínimo" : "máximo"} conocido`,
        ]);
  }
  return opts;
}
function renderSort() {
  const s = state();
  const panel = $("sort-panel");
  panel.replaceChildren(
    el("strong", {}, "Prioridad de ordenación"),
    el(
      "p",
      { class: "help" },
      "Los agregados de relaciones describen lo conocido. Las cantidades pueden ser mínimos; los extremos pueden cambiar al completar los datos.",
    ),
  );
  s.sort.forEach((sort, i) => {
    const { direction, ...key } = sort;
    panel.append(
      el(
        "div",
        { class: "sort-row" },
        el("span", {}, i + 1),
        select(
          sortOptions(),
          JSON.stringify(key),
          (v) => {
            s.sort[i] = { ...JSON.parse(v), direction };
            refresh();
          },
          { "aria-label": `Criterio ${i + 1}` },
        ),
        select(
          [
            ["asc", "Ascendente"],
            ["desc", "Descendente"],
          ],
          direction,
          (v) => {
            sort.direction = v;
            refresh();
          },
          { "aria-label": `Dirección ${i + 1}` },
        ),
        button(
          "↑",
          () => {
            [s.sort[i - 1], s.sort[i]] = [s.sort[i], s.sort[i - 1]];
            renderSort();
            refresh();
          },
          {
            disabled: i === 0 ? "" : undefined,
            "aria-label": "Subir criterio",
          },
        ),
        button(
          "Quitar",
          () => {
            s.sort.splice(i, 1);
            renderSort();
            refresh();
          },
          { class: "mini" },
        ),
      ),
    );
  });
  panel.append(
    button("Añadir criterio", () => {
      s.sort.push({
        field: defaults[current]?.[0] || "name",
        direction: "asc",
      });
      renderSort();
      refresh();
    }),
  );
}
function typeBadge(id) {
  return el("span", { class: "badge", "data-type": id }, label("types", id));
}
function cell(c, row, path) {
  const value = fieldValue(row, path);
  if (value.fraction)
    return el(
      "span",
      { class: "numeric", title: `${value.value} de los PS máximos` },
      `${value.fraction[0]}/${value.fraction[1]} de los PS`,
    );
  if (value.status !== "known")
    return el(
      "span",
      { class: value.status === "unknown" ? "pending" : "muted" },
      value.status === "variable"
        ? "Variable"
        : value.status === "na"
          ? c === "natures"
            ? "No modifica"
            : "No aplicable"
          : "Pendiente",
    );
  if (path === "typeId" || path === "typeIds")
    return el("span", {}, [].concat(value.value).map(typeBadge));
  const ref = referenceCollection(row, path);
  const text = ref
    ? referenceText(ref, value.value, graph)
    : pretty(value.value);
  if (Array.isArray(value.value) && value.value.length > 3)
    return el(
      "details",
      {},
      el(
        "summary",
        {},
        `${pretty(value.value.slice(0, 3))} +${value.value.length - 3}`,
      ),
      text,
    );
  return el(
    "span",
    {
      class: `cell-value ${path === "abilityIds" ? "abilities-cell" : ""} ${typeof value.value === "number" ? "numeric" : ""}`,
      title: text,
    },
    text,
  );
}
function renderResults(result) {
  const s = state(),
    c = current;
  const rows = result[s.bucket];
  s.page = Math.max(1, Math.min(s.page, Math.ceil(rows.length / s.size) || 1));
  $("confirmed-count").textContent =
    result.confirmed.length.toLocaleString("es");
  $("possible-count").textContent = result.possible.length.toLocaleString("es");
  $("confirmed-tab").setAttribute(
    "aria-pressed",
    String(s.bucket === "confirmed"),
  );
  $("possible-tab").setAttribute(
    "aria-pressed",
    String(s.bucket === "possible"),
  );
  $("result-note").textContent =
    s.bucket === "possible"
      ? "No se puede determinar si cumplen todas las condiciones."
      : `${database.data[c].length.toLocaleString("es")} registros publicados`;
  if (s.matrix && c === "types") {
    renderMatrix(rows);
    return;
  }
  const shown = rows.slice((s.page - 1) * s.size, s.page * s.size),
    columns = s.columns.filter((p) => p !== "name");
  const table = el(
    "table",
    {},
    el(
      "caption",
      { class: "sr-only" },
      `${titles[c]}: ${s.bucket === "confirmed" ? "coincidencias confirmadas" : "posibles coincidencias"}`,
    ),
  );
  const header = el("tr");
  for (const path of ["name", ...columns]) {
    const sort = s.sort.find((x) => !x.relation && x.field === path);
    const pos = s.sort.indexOf(sort);
    header.append(
      el(
        "th",
        {
          scope: "col",
          "aria-sort":
            pos === 0
              ? sort.direction === "desc"
                ? "descending"
                : "ascending"
              : "none",
        },
        button(
          `${path === "name" ? "Nombre" : field(c, path).label}${sort ? ` ${sort.direction === "asc" ? "↑" : "↓"}${pos + 1}` : ""}`,
          (e) => {
            const direction = sort?.direction === "asc" ? "desc" : "asc";
            if (e.shiftKey) {
              if (sort) sort.direction = direction;
              else s.sort.push({ field: path, direction });
            } else s.sort = [{ field: path, direction }];
            renderSort();
            refresh();
          },
        ),
      ),
    );
  }
  if (s.bucket === "possible")
    header.append(el("th", { scope: "col" }, "Por verificar"));
  table.append(el("thead", {}, header));
  const body = el("tbody");
  for (const row of shown) {
    const tr = el(
      "tr",
      {},
      el(
        "td",
        {},
        button(name(c, row), () => showDetail(c, row), {
          class: "name-button",
        }),
      ),
    );
    for (const path of columns) tr.append(el("td", {}, cell(c, row, path)));
    if (s.bucket === "possible")
      tr.append(
        el(
          "td",
          { class: "reason" },
          undecided(s.query, c, row, graph).map((x) => el("div", {}, x)),
        ),
      );
    body.append(tr);
  }
  table.append(body);
  $("table-wrap").replaceChildren(
    rows.length
      ? table
      : el(
          "div",
          { class: "empty" },
          "No hay resultados para estas condiciones.",
          el(
            "p",
            {},
            result.possible.length
              ? "Consulta «Posibles» para ver los casos pendientes de verificar."
              : "Prueba a quitar una condición o ampliar un rango.",
          ),
        ),
  );
  $("pagination").replaceChildren(
    el(
      "span",
      {},
      rows.length
        ? `${(s.page - 1) * s.size + 1}–${Math.min(s.page * s.size, rows.length)} de ${rows.length.toLocaleString("es")}`
        : "0 resultados",
    ),
    el(
      "div",
      {},
      el(
        "label",
        {},
        "Filas ",
        select(
          [25, 50, 100].map((n) => [n, n]),
          s.size,
          (v) => {
            s.size = Number(v);
            s.page = 1;
            refresh();
          },
          { "aria-label": "Filas por página" },
        ),
      ),
      button(
        "Anterior",
        () => {
          s.page--;
          refresh();
        },
        { disabled: s.page === 1 ? "" : undefined },
      ),
      el("span", {}, `${s.page} / ${Math.ceil(rows.length / s.size) || 1}`),
      button(
        "Siguiente",
        () => {
          s.page++;
          refresh();
        },
        { disabled: s.page * s.size >= rows.length ? "" : undefined },
      ),
    ),
  );
}
function renderMatrix(rows) {
  const types = database.data.types,
    table = el(
      "table",
      {},
      el(
        "caption",
        { class: "sr-only" },
        "Efectividad: atacante por fila, defensor por columna",
      ),
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", { scope: "col" }, "Ataque ↓ / Defensa →"),
          types.map((t) => el("th", { scope: "col" }, t.name)),
        ),
      ),
    );
  table.append(
    el(
      "tbody",
      {},
      rows.map((t) =>
        el(
          "tr",
          {},
          el(
            "td",
            {},
            button(t.name, () => showDetail("types", t), {
              class: "name-button",
            }),
          ),
          types.map((d) =>
            el("td", {}, `${t.effectiveness?.[d.id] ?? "Pendiente"}×`),
          ),
        ),
      ),
    ),
  );
  $("table-wrap").replaceChildren(table);
  $("pagination").replaceChildren(
    el("span", {}, "Cada fila es el tipo atacante. 0× indica inmunidad."),
  );
}
function openDialog(title) {
  if (!$("detail").open) {
    lastFocus = document.activeElement;
    $("detail").showModal();
  }
  $("detail-title").textContent = title;
  $("detail-body").replaceChildren();
  return $("detail-body");
}
async function showDetail(c, row) {
  const token = ++detailRequest;
  const box = openDialog(name(c, row));
  const fields = el("dl", { class: "detail-fields" });
  for (const f of database.catalog[c])
    fields.append(el("dt", {}, f.label), el("dd", {}, cell(c, row, f.path)));
  box.append(fields, el("p", { class: "help" }, `Referencia: ${row.id}`));
  const relations = el(
    "section",
    {},
    el("h3", {}, "Relaciones"),
    el("p", { class: "muted" }, "Cargando relaciones…"),
  );
  box.append(relations);
  const sources = el("section", {}, el("h3", {}, "Fuentes por campo"));
  box.append(sources);
  sources.append(
    button("Consultar evidencias", async () => {
      sources.replaceChildren(
        el("p", {}, "Cargando evidencias de este registro…"),
      );
      try {
        const [record, documents] = await database.evidence(c, row.id);
        if (token !== detailRequest) return;
        sources.replaceChildren(el("h3", {}, "Evidencias y campos pendientes"));
        for (const [path, fact] of Object.entries(record.facts)) {
          const witnesses = fact.witnesses.map((id) => record.observations[id]);
          sources.append(
            el(
              "details",
              { class: "evidence" },
              el(
                "summary",
                {},
                `${pathLabel(path)} · ${new Set(witnesses.map((w) => w.provider)).size} proveedores`,
              ),
              witnesses.map((w) => {
                const doc = documents[w.document];
                const url = doc?.url;
                return el(
                  "p",
                  {},
                  url && /^https?:\/\//.test(url)
                    ? el(
                        "a",
                        {
                          href: url,
                          target: "_blank",
                          rel: "noopener noreferrer",
                        },
                        w.provider,
                      )
                    : w.provider,
                  ` · ${w.locator}`,
                  el("br"),
                  `Observado: ${pretty(w.observed)} · Revisión: ${doc?.revision || "sin revisión"} · Captura: ${doc?.capturedAt || "sin fecha"}`,
                  el("br"),
                  `SHA-256: ${w.sha256}`,
                );
              }),
            ),
          );
        }
        if (record.pending.length)
          sources.append(
            el("h3", {}, "Pendiente de corroboración"),
            record.pending.map((p) =>
              el("p", { class: "pending" }, `${p.claim}: ${p.reason}`),
            ),
          );
      } catch (e) {
        sources.replaceChildren(el("p", { class: "error" }, e.message));
      }
    }),
  );
  try {
    await database.relations();
    if (token !== detailRequest) return;
    graph = database.graph;
    fields.replaceChildren();
    for (const f of database.catalog[c])
      fields.append(el("dt", {}, f.label), el("dd", {}, cell(c, row, f.path)));
    relations.replaceChildren(
      el("h3", {}, "Relaciones verificadas"),
      el(
        "p",
        { class: "help" },
        "Las listas pueden estar incompletas. Una lista vacía no demuestra imposibilidad.",
      ),
    );
    for (const [key, target] of Object.entries(relationDefs[c] || {})) {
      if (target === "*" || key === "producers") continue;
      const r = graph.related(c, row, key);
      const section = el(
        "details",
        {},
        el(
          "summary",
          {},
          `${relationLabels[key]} · ${r.rows.length}${r.complete ? "" : " conocidos"}`,
        ),
      );
      if (r.rows.length)
        section.append(
          el(
            "div",
            { class: "related-list" },
            r.rows.slice(0, 12).map((item) =>
              button(name(target, item), () => showDetail(target, item), {
                class: "mini",
              }),
            ),
          ),
          button(
            "Consultar tabla relacionada",
            () => {
              const ids = r.rows.map((x) => x.id);
              const s = states.get(target) || newState(target);
              s.query = {
                kind: "group",
                mode: "all",
                children: [
                  { kind: "condition", field: "id", op: "in", value: ids },
                ],
              };
              s.page = 1;
              s.bucket = "confirmed";
              states.set(target, s);
              $("detail").close();
              navigate(target);
            },
            { class: "mini" },
          ),
        );
      relations.append(section);
    }
    if (c === "effects") {
      const section = el("section");
      const renderProducers = (includeIndirect) => {
        const producers = graph.index.producersOfEffect(row.id, {
          includeIndirect,
        });
        section.replaceChildren(
          el("h3", {}, "Pokémon que provocan este efecto"),
          el(
            "label",
            {},
            el("input", {
              type: "checkbox",
              checked: includeIndirect,
              onchange: (e) => renderProducers(e.target.checked),
            }),
            " Incluir rutas indirectas condicionadas",
          ),
        );
        for (const { pokemon, paths } of producers.records)
          section.append(
            el(
              "details",
              {},
              el("summary", {}, name("pokemon", pokemon)),
              paths.map((path) =>
                el(
                  "p",
                  {},
                  `${path.kind === "direct" ? "Vía directa" : "Vía indirecta, elegibilidad sin evaluar"}: ${pretty(path.via.id)}. ${path.copied ? `Origen copiado: ${pretty(path.copied.id)}. ` : ""}Requisitos: ${pretty(path.requirements)}. ${path.parameters ? pretty(path.parameters) : ""}`,
                ),
              ),
            ),
          );
        if (!producers.records.length)
          section.append(
            el(
              "p",
              { class: "muted" },
              "No hay productores corroborados en el catálogo actual.",
            ),
          );
      };
      renderProducers(false);
      relations.append(section);
    }
  } catch (e) {
    relations.replaceChildren(
      el("p", { class: "error" }, e.message),
      button("Reintentar relaciones", () => showDetail(c, row)),
    );
  }
}
function coverageDialog() {
  const box = openDialog("Cobertura y fuentes");
  box.append(
    el(
      "p",
      {},
      "Solo se muestran valores corroborados por dos proveedores. Esto no garantiza independencia entre proveedores ni cobertura completa del juego.",
    ),
    el("p", {}, `Conjunto: ${database.manifest.datasetId}`),
    el(
      "p",
      {},
      "Las restricciones de los reglamentos y las mecánicas pendientes no se completan con datos de otros juegos.",
    ),
  );
  const table = el(
    "table",
    {},
    el(
      "thead",
      {},
      el(
        "tr",
        {},
        [
          "Colección",
          "Publicados",
          "Inventariados",
          "Campos verificados / esperados",
        ].map((x) => el("th", {}, x)),
      ),
    ),
  );
  table.append(
    el(
      "tbody",
      {},
      Object.entries(database.coverage.collections).map(([c, v]) =>
        el(
          "tr",
          {},
          el("td", {}, titles[c]),
          el("td", {}, v.recordsPublished),
          el("td", {}, v.inventoried),
          el("td", {}, `${v.fieldsPublished} / ${v.fieldsExpected}`),
        ),
      ),
    ),
  );
  box.append(el("div", { class: "table-wrap" }, table));
}
$("theme").onclick = () => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  $("theme").setAttribute(
    "aria-label",
    `Cambiar a tema ${document.documentElement.dataset.theme === "dark" ? "claro" : "oscuro"}`,
  );
};
document.documentElement.dataset.theme = matchMedia(
  "(prefers-color-scheme: dark)",
).matches
  ? "dark"
  : "light";
$("quick-tab").onclick = () => {
  mode = "quick";
  renderEditor();
};
$("advanced-tab").onclick = () => {
  mode = "advanced";
  renderEditor();
};
$("filters-toggle").onclick = () => {
  filterOpen = !filterOpen;
  document.querySelector(".layout").classList.toggle("collapsed", !filterOpen);
  $("filters-toggle").setAttribute("aria-expanded", String(filterOpen));
};
document.querySelector(".layout").classList.toggle("collapsed", !filterOpen);
$("filters-toggle").setAttribute("aria-expanded", String(filterOpen));
$("reset").onclick = () => {
  states.set(current, newState(current));
  navigate(current);
};
$("search").oninput = (e) => {
  state().search = e.target.value;
  state().page = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 150);
};
for (const bucket of ["confirmed", "possible"])
  $(bucket + "-tab").onclick = () => {
    state().bucket = bucket;
    state().page = 1;
    refresh();
  };
for (const name of ["columns", "sort"])
  $(name + "-button").onclick = () => {
    $(name + "-panel").hidden = !$(name + "-panel").hidden;
    $(name + "-button").setAttribute(
      "aria-expanded",
      String(!$(name + "-panel").hidden),
    );
  };
$("close-detail").onclick = () => $("detail").close();
$("detail").addEventListener("close", () => {
  detailRequest++;
  lastFocus?.focus();
});
$("coverage-button").onclick = () => {
  if (database?.coverage) coverageDialog();
};
async function start() {
  try {
    database = await new Database().init();
    graph = database.graph;
    $("workspace").hidden = false;
    $("version").textContent =
      `Champions ${database.manifest.context.gameVersion}`;
    navigate("pokemon");
  } catch (e) {
    error(e.message, start);
  }
}
start();
