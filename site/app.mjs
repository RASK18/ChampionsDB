import { Database } from "./loader.mjs";
import { moveTraitDefinitions } from "./move-tags.mjs";
import { isTeamEntryForm } from "./form-roles.mjs";
import { renderPokemonDetail } from "./pokemon-detail.mjs";
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
  evaluate,
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
  pokemonDetailId = null,
  listFocus = null,
  listScrollY = 0,
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
    includeBattleForms: false,
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
  return `${row.id} · sin nombre en la fuente`;
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
  if (n.kind === "coverage") return n.target === "all" ? "Cobertura al menos neutral frente a cada tipo" : `Supereficaz contra ${label("types", n.target)}`;
  if (n.kind === "defense") return `${{ resist: "Resiste", immune: "Inmune a", weak: "Débil a" }[n.mode]} ${label("types", n.typeId)}`;
  if (n.kind === "moveTrait") return traitChoices.find(([id]) => id === n.trait)?.[1] || n.trait;
  if (n.kind === "group") {
    if (!n.children.length) return "Sin condiciones";
    return `${n.mode === "all" ? "Todas" : n.mode === "any" ? "Alguna" : "Ninguna"}: (${n.children.map((x) => summary(x, c)).join(" · ")})`;
  }
  if (n.kind === "relation")
    return `${relationLabels[n.relation]} [${{ some: "alguno", none: "ninguno", all: "todos", count: "cantidad" }[n.quantifier]}]: ${summary(n.query, n.targetCollection || relationDefs[c][n.relation])}`;
  return `${field(c, n.field).label} ${opLabels[n.op]} ${["known", "unknown", "na"].includes(n.op) ? "" : pretty(n.value)}`;
}
function validate(n) {
  if (["coverage", "defense", "moveTrait"].includes(n.kind)) return true;
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
    n.kind === "relation" || n.kind === "coverage" ||
    (n.kind === "group" && n.children.some(hasRelation))
  );
}
function savePokemonHistory() {
  if (current !== "pokemon") return;
  const s = state();
  history.replaceState({ ...history.state, championsDB: {
    query: clone(s.query), search: s.search, includeBattleForms: s.includeBattleForms,
    columns: [...s.columns], sort: clone(s.sort), page: s.page, size: s.size,
    bucket: s.bucket, matrix: s.matrix,
  } }, "");
}
function detailHash(id) {
  return `#pokemon/${encodeURIComponent(id)}`;
}
function hashPokemonId() {
  const match = /^#pokemon\/([^/]+)$/.exec(location.hash);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}
function hidePokemonDetail({ restoreFocus = false } = {}) {
  pokemonDetailId = null;
  detailRequest++;
  document.body.classList.remove("pokemon-detail-open");
  $("pokemon-detail-view").hidden = true;
  $("workspace").hidden = false;
  document.querySelector(".skip").href = "#results";
  document.title = "ChampionsDB · Datos de combate";
  if (restoreFocus) {
    requestAnimationFrame(() => {
      window.scrollTo(0, listScrollY);
      listFocus?.focus({ preventScroll: true });
    });
  }
}
async function openPokemonDetail(row, { push = true } = {}) {
  if (push) {
    savePokemonHistory();
    listFocus = document.activeElement;
    listScrollY = scrollY;
    history.pushState({ ...history.state, pokemonDetailId: row.id, fromList: true }, "", detailHash(row.id));
  } else if (pokemonDetailId && pokemonDetailId !== row.id) {
    history.replaceState({ ...history.state, pokemonDetailId: row.id }, "", detailHash(row.id));
  }
  if ($("detail").open) $("detail").close();
  pokemonDetailId = row.id;
  const token = ++detailRequest;
  document.body.classList.add("pokemon-detail-open");
  $("workspace").hidden = true;
  $("pokemon-detail-view").hidden = false;
  document.querySelector(".skip").href = "#pokemon-detail-title";
  $("pokemon-detail-content").replaceChildren(el("p", { class: "muted" }, "Cargando datos de combate…"));
  document.title = `${row.name} · ChampionsDB`;
  window.scrollTo(0, 0);
  try {
    await database.relations();
    if (token !== detailRequest) return;
    graph = database.graph;
    renderPokemonDetail($("pokemon-detail-content"), row, graph, {
      openEntry: (entry) => openPokemonDetail(entry, { push: false }),
    });
    $("pokemon-back").focus({ preventScroll: true });
  } catch (e) {
    if (token === detailRequest)
      $("pokemon-detail-content").replaceChildren(el("p", { class: "error" }, `No se pudo cargar la ficha: ${e.message}`), button("Reintentar", () => openPokemonDetail(row, { push: false })));
  }
}
function closePokemonDetail() {
  if (history.state?.fromList) history.back();
  else {
    history.replaceState({ ...history.state, pokemonDetailId: null, fromList: false }, "", location.pathname + location.search);
    hidePokemonDetail({ restoreFocus: true });
  }
}
function error(message, retry) {
  $("notice").replaceChildren(
    el("div", { class: "error" }, message, " ", button("Reintentar", retry)),
  );
}
function notice() {
  const text = 'Aprendizajes certificados para la captura de Champions. La legalidad del equipo y todas las mecánicas de combate aún no están certificadas. Consulta «Cobertura y fuentes».';
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
  savePokemonHistory();
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
    const searchable = c === 'pokemon' && !s.includeBattleForms
      ? database.data[c].filter(isTeamEntryForm) : database.data[c];
    const result = queryRows(
      searchable,
      c,
      s.query,
      s.search,
      s.sort,
      graph,
    );
    result.scopeCount = searchable.length;
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
  if (pokemonDetailId) {
    history.pushState({ ...history.state, pokemonDetailId: null, fromList: false }, "", location.pathname + location.search);
    hidePokemonDetail();
  }
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
      ? "Encuentra Pokémon por habilidad, movimiento, rol, estadísticas y cobertura."
      : c === "regulations"
        ? "Las restricciones pendientes no implican que un Pokémon sea legal."
        : "Consulta los campos documentados y sus relaciones de combate.";
  renderNavigation();
  renderSubnav();
  renderIdeas();
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
const statChoices = [
  ["stats.speed", "Velocidad"], ["stats.attack", "Ataque"],
  ["stats.spAttack", "At. Especial"], ["stats.defense", "Defensa"],
  ["stats.spDefense", "Def. Especial"], ["stats.hp", "PS"],
];
const traitChoices = [
  ["pivot", "Movimiento de cambio"],
  ["multihit", "Multigolpe"],
  ["control", "Limita acciones del rival"],
];
const moveFields = [
  ["id", "Movimiento concreto"], ["trait", "Característica"],
  ["typeId", "Tipo"], ["category", "Categoría"],
  ["power.value", "Potencia"], ["priority", "Prioridad"],
  ["target", "Objetivo"], ["properties.contact", "Contacto"],
  ["properties.sound", "Sonido"], ["properties.punch", "Puño"],
  ["properties.bite", "Mordisco"], ["properties.slicing", "Corte"],
];
const criterion = (field, op, value) => ({ kind: "condition", field, op, value });
const moveBlock = (...children) => ({
  kind: "relation", relation: "moves", quantifier: "some",
  query: { kind: "group", mode: "all", children },
});
const role = (name, ...children) => ({
  kind: "group", mode: "all", role: name, children,
});
function abilityCriterion(name) {
  const found = database.data.abilities.find((a) => a.name === name);
  if (!found) throw Error(`No se encuentra la habilidad ${name}`);
  return criterion("abilityIds", "some", [found.id]);
}
const ideas = [
  ["Intimidación y cambio", "Intimidación + un movimiento que permite salir y entrar a un compañero.", () => [abilityCriterion("Intimidación"), moveBlock({ kind: "moveTrait", trait: "pivot" })]],
  ["Cobertura amplia", "Velocidad base ≥ 100 y daño al menos neutral frente a cada tipo por separado.", () => [criterion("stats.speed", "gte", 100), { kind: "coverage", target: "all" }]],
  ["Atacante para Espacio Raro", "Velocidad base ≤ 40 y Ataque o At. Especial ≥ 100. Es una regla exploratoria, no una recomendación de set.", () => [role("Atacante para Espacio Raro", criterion("stats.speed", "lte", 40), { kind: "group", mode: "any", children: [criterion("stats.attack", "gte", 100), criterion("stats.spAttack", "gte", 100)] })]],
  ["Bromista y control", "Bromista + Anulación, Atracción, Otra Vez, Tormento o Mofa. Esta búsqueda no incluye todos los movimientos de apoyo.", () => [abilityCriterion("Bromista"), moveBlock({ kind: "moveTrait", trait: "control" })]],
  ["Experto y multigolpe", "Experto + un mismo movimiento multigolpe de potencia como máximo 60.", () => [abilityCriterion("Experto"), moveBlock({ kind: "moveTrait", trait: "multihit" }, criterion("power.value", "lte", 60))]],
  ["Atacante especial rápido", "Velocidad base y At. Especial de 100 o más; ajusta ambos umbrales a tu equipo.", () => [criterion("stats.speed", "gte", 100), criterion("stats.spAttack", "gte", 100)]],
  ["Prioridad ofensiva", "Aprende un mismo movimiento de prioridad positiva y potencia conocida superior a cero.", () => [moveBlock(criterion("priority", "gte", 1), criterion("power.value", "gte", 1))]],
];
const ideaIcons = ['◉', '▦', '☆', '✧', '◈', 'ϟ', '≫'];
function renderIdeas() {
  $("inspiration").hidden = current !== "pokemon";
  if (current !== "pokemon") return;
  $("idea-list").replaceChildren(...ideas.map(([title, description, make], index) =>
    button([el('span', {class: 'idea-icon', 'aria-hidden': 'true'}, ideaIcons[index]), title], () => {
      state().query = { kind: "group", mode: "all", children: make() };
      state().search = "";
      $("search").value = "";
      state().page = 1;
      state().bucket = "confirmed";
      mode = "quick";
      filterOpen = true;
      document.querySelector(".layout").classList.remove("collapsed");
      $("filters-toggle").setAttribute("aria-expanded", "true");
      renderEditor();
      refresh();
      if (innerWidth <= 700) $("filters").scrollIntoView({ block: "start" });
    }, { class: "idea", title: description, "aria-label": `${title}. ${description}` }),
  ));
}
function addExplore(kind) {
  let node;
  if (kind === "ability") node = criterion("abilityIds", "some", [database.data.abilities[0].id]);
  if (kind === "type") node = criterion("typeIds", "some", [database.data.types[0].id]);
  if (kind === "stat") node = criterion("stats.speed", "gte", 100);
  if (kind === "move") node = moveBlock();
  if (kind === "coverage") node = { kind: "coverage", target: "all" };
  if (kind === "defense") node = { kind: "defense", typeId: "water", mode: "resist" };
  if (kind === "role") node = ideas[2][2]()[0];
  state().query.children.push(node);
  mutate();
}
async function ensureMoveOptions() {
  try {
    if (!database.data.moves) await database.ensure(["moves"]);
    graph = database.graph;
    return true;
  } catch (e) {
    error(e.message, refresh);
    return false;
  }
}
function choice(label, entries, value, change) {
  return el("label", { class: "explore-control" }, label,
    select(entries, value, change, { "aria-label": label }));
}
function searchableChoice(label, rows, value, change) {
  const picker = select(rows.map((row) => [row.id, row.name]), value, change, { "aria-label": label });
  const search = el("input", { type: "search", placeholder: `Buscar ${label.toLocaleLowerCase("es")}…`,
    "aria-label": `Buscar ${label.toLocaleLowerCase("es")}`,
    oninput: (event) => {
      const selected = picker.value;
      const term = event.target.value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es");
      const filtered = rows.filter((row) => row.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es").includes(term));
      picker.replaceChildren(el("option", { value: "", disabled: "" }, filtered.length ? "Selecciona una opción…" : "No hay coincidencias"),
        ...filtered.map((row) => option(row.id, row.name)));
      picker.value = filtered.some((row) => row.id === selected) ? selected : "";
    } });
  return el("div", { class: "explore-control" }, el("span", {}, label), search, picker);
}
function numberControl(label, value, change) {
  return el("label", { class: "explore-control" }, label,
    el("input", { type: "number", value, "aria-label": label,
      oninput: (e) => { change(e.target.value === "" ? NaN : Number(e.target.value)); refresh(); } }));
}
function nodeTitle(node) {
  if (node.kind === "relation") return "Debe aprender un movimiento que…";
  if (node.kind === "coverage") return "Cobertura ofensiva";
  if (node.kind === "defense") return "Defensa ante un tipo";
  if (node.role) return node.role;
  if (node.field === "abilityIds") return "Habilidad";
  if (node.field === "typeIds") return "Tipo";
  if (node.field?.startsWith("stats.")) return "Estadística base";
  return "Condición";
}
function moveCondition(kind) {
  if (kind === "trait") return { kind: "moveTrait", trait: "pivot" };
  if (kind === "id") return criterion("id", "eq", database.data.moves[0].id);
  if (["power.value", "priority"].includes(kind)) return criterion(kind, "lte", kind === "priority" ? 1 : 60);
  if (kind.startsWith("properties.")) return criterion(kind, "eq", true);
  return criterion(kind, "eq", kind === "typeId" ? database.data.types[0].id : kind === "category" ? "physical" : "selected-pokemon");
}
function renderMoveCondition(node, parent) {
  const box = el("div", { class: "move-condition" });
  const kind = node.kind === "moveTrait" ? "trait" : node.field;
  box.append(choice("Propiedad del movimiento", moveFields, kind, async (v) => {
    if (v === "id" && !(await ensureMoveOptions())) return;
    parent.children[parent.children.indexOf(node)] = moveCondition(v); mutate();
  }));
  if (kind === "trait") box.append(choice("Característica", traitChoices, node.trait, (v) => { node.trait = v; mutate(); }),
    el("p", { class: "card-hint" }, moveTraitDefinitions[node.trait]?.description));
  else if (kind === "id") box.append(searchableChoice("Movimiento", database.data.moves, node.value, (v) => { node.value = v; refresh(); }));
  else if (kind === "typeId") box.append(choice("Tipo", database.data.types.map((t) => [t.id, t.name]), node.value, (v) => { node.value = v; refresh(); }));
  else if (kind === "category") box.append(choice("Categoría", [["physical", "Físico"], ["special", "Especial"], ["status", "Estado"]], node.value, (v) => { node.value = v; refresh(); }));
  else if (kind === "target") box.append(choice("Objetivo", field("moves", "target").options.map((v) => [v, translate(v)]), node.value, (v) => { node.value = v; refresh(); }));
  else if (kind.startsWith("properties.")) box.append(choice("Debe cumplir", [["true", "Sí"], ["false", "No"]], String(node.value), (v) => { node.value = v === "true"; refresh(); }));
  else box.append(choice("Comparación", [["lte", "Como máximo"], ["gte", "Al menos"]], node.op, (v) => { node.op = v; refresh(); }), numberControl(kind === "priority" ? "Prioridad" : "Potencia", node.value, (v) => { node.value = v; }));
  box.append(button("Quitar", () => { parent.children.splice(parent.children.indexOf(node), 1); mutate(); }, { class: "mini", "aria-label": `Quitar ${moveFields.find(([id]) => id === kind)?.[1] || "propiedad"}` }));
  return box;
}
function renderExploreCard(raw) {
  const root = state().query;
  const excluded = raw.kind === "group" && raw.excluded;
  const node = excluded ? raw.children[0] : raw;
  const box = el("article", { class: "explore-card" });
  box.append(el("div", { class: "explore-card-head" },
    el("strong", {}, nodeTitle(node)),
    button("Quitar", () => { root.children.splice(root.children.indexOf(raw), 1); mutate(); }, { class: "mini" })));
  if (!node.role) box.append(choice("Condición", [["include", "Debe cumplir"], ["exclude", "Excluir"]], excluded ? "exclude" : "include", (v) => {
    root.children[root.children.indexOf(raw)] = v === "exclude" ? { kind: "group", mode: "none", excluded: true, children: [node] } : node;
    mutate();
  }));
  if (node.kind === "relation" && node.relation === "moves") {
    box.append(el("p", { class: "card-hint" }, "Todas estas propiedades pertenecen a un mismo movimiento aprendido."));
    for (const child of node.query.children) box.append(renderMoveCondition(child, node.query));
    box.append(choice("Añadir propiedad", [["", "Selecciona una propiedad…"], ...moveFields], "", async (v) => {
      if (!v) return;
      if (v === "id" && !(await ensureMoveOptions())) return;
      node.query.children.push(moveCondition(v)); mutate();
    }));
  } else if (node.kind === "coverage") {
    box.append(choice("Qué debe cubrir", [["all", "Todos los tipos (daño al menos neutral)"], ...database.data.types.map((t) => [t.id, `Supereficaz contra ${t.name}`])], node.target, (v) => { node.target = v; refresh(); }));
    box.append(el("p", { class: "card-hint" }, "Se comprueba cada tipo defensor por separado con los movimientos aprendidos. No implica cubrir todas las combinaciones de dos tipos."));
  } else if (node.kind === "defense") {
    box.append(choice("Tipo atacante", database.data.types.map((t) => [t.id, t.name]), node.typeId, (v) => { node.typeId = v; refresh(); }),
      choice("Resultado", [["resist", "Resiste (menos de 1×)"], ["immune", "Es inmune (0×)"], ["weak", "Es débil (más de 1×)"]], node.mode, (v) => { node.mode = v; refresh(); }));
  } else if (node.role) {
    const speed = node.children.find((part) => part.field === "stats.speed");
    const offense = node.children.find((part) => part.kind === "group" && part.mode === "any");
    const attack = offense?.children.find((part) => part.field === "stats.attack");
    const special = offense?.children.find((part) => part.field === "stats.spAttack");
    const clearRule = speed?.op === "lte" && attack?.op === "gte" && special?.op === "gte";
    const ruleText = clearRule
      ? `Criterios actuales: Velocidad ≤ ${speed.value} y Ataque ≥ ${attack.value} o At. Especial ≥ ${special.value}.`
      : `Criterios actuales: ${summary(node, "pokemon")}.`;
    box.append(el("p", { class: "card-hint" }, ruleText, " ",
      speed?.value > 45 ? "Has ampliado la velocidad por encima del umbral habitual de Espacio Raro. " : "",
      "Es una regla exploratoria, no una recomendación de set."),
      button("Editar los umbrales", () => { mode = "advanced"; renderEditor(); }, { class: "mini" }));
  } else if (node.field === "abilityIds" || node.field === "typeIds") {
    const rows = node.field === "abilityIds" ? database.data.abilities : database.data.types;
    box.append(node.field === "abilityIds"
      ? searchableChoice("Habilidad", rows, node.value[0], (v) => { node.value = [v]; refresh(); })
      : choice("Tipo", rows.map((r) => [r.id, r.name]), node.value[0], (v) => { node.value = [v]; refresh(); }));
  } else if (node.field?.startsWith("stats.")) {
    box.append(choice("Estadística", statChoices, node.field, (v) => { node.field = v; refresh(); }),
      choice("Comparación", [["gte", "Al menos"], ["lte", "Como máximo"]], node.op, (v) => { node.op = v; refresh(); }),
      numberControl("Valor base", node.value, (v) => { node.value = v; }));
  } else box.append(el("p", { class: "card-hint" }, "Esta condición se edita en «Todos los campos»."));
  return box;
}
function exploreEditor() {
  const box = el("div", { class: "explore-editor" });
  const root = state().query;
  box.append(choice("Cómo combinar", [["all", "Cumplir todas"], ["any", "Cumplir cualquiera"], ["none", "No cumplir ninguna"]], root.mode, (v) => { root.mode = v; refresh(); }));
  if (!root.children.length) box.append(el("p", { class: "card-hint" }, "Elige una idea de arriba o añade una condición para empezar."));
  for (const child of root.children) box.append(renderExploreCard(child));
  box.append(choice("Añadir criterio", [["", "Selecciona un criterio…"], ["ability", "Habilidad"], ["type", "Tipo"], ["stat", "Estadística"], ["move", "Movimiento aprendido"], ["coverage", "Cobertura ofensiva"], ["defense", "Resistencia o debilidad"], ["role", "Atacante para Espacio Raro"]], "", (v) => { if (v) addExplore(v); }));
  return box;
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
  const editor = mode === "quick" ? current === "pokemon" ? exploreEditor() : quickEditor() : renderGroup(state().query, current);
  $("filter-editor").replaceChildren(
    current === 'pokemon' ? el('label', {class:'form-scope'},
      el('input', {type:'checkbox', checked:state().includeBattleForms,
        onchange:(event)=>{state().includeBattleForms=event.target.checked;state().page=1;refresh();}}),
      ' Incluir Mega y otras formas que aparecen solo en combate') : null,
    editor,
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
          : ["coverage", "defense", "moveTrait"].includes(child.kind)
            ? renderSemantic(child, node)
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
function renderSemantic(node, parent) {
  const box = el("div", { class: "clause" }, itemTools(parent, node));
  if (node.kind === "coverage") box.append(
    el("strong", {}, "Cobertura ofensiva"),
    choice("Qué debe cubrir", [["all", "Todos los tipos: daño al menos neutral"], ...database.data.types.map((t) => [t.id, `Supereficaz contra ${t.name}`])], node.target, (v) => { node.target = v; refresh(); }),
  );
  if (node.kind === "defense") box.append(
    el("strong", {}, "Defensa ante un tipo"),
    choice("Tipo atacante", database.data.types.map((t) => [t.id, t.name]), node.typeId, (v) => { node.typeId = v; refresh(); }),
    choice("Resultado", [["resist", "Resiste"], ["immune", "Inmune"], ["weak", "Débil"]], node.mode, (v) => { node.mode = v; refresh(); }),
  );
  if (node.kind === "moveTrait") box.append(
    el("strong", {}, "Característica del movimiento"),
    choice("Característica", traitChoices, node.trait, (v) => { node.trait = v; refresh(); }),
  );
  return box;
}
function renderClause(node, c, parent) {
  const f = field(c, node.field);
  const box = el("div", { class: "clause" }, itemTools(parent, node));
  if (node.field === "id" && c === "moves" && typeof node.value === "string") {
    box.append(searchableChoice("Movimiento", database.data.moves, node.value, (v) => { node.value = v; refresh(); }));
    return box;
  }
  if (node.field === "id" && Array.isArray(node.value)) {
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
          : "Sin dato",
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
function matchEvidence(node, c, row) {
  if (node.kind === "group") {
    if (node.mode === "none") return ["No cumple las condiciones excluidas"];
    const selected = node.mode === "any"
      ? node.children.filter((child) => evaluate(child, c, row, graph) === true).slice(0, 1)
      : node.children;
    return selected.flatMap((child) => matchEvidence(child, c, row));
  }
  if (node.kind === "relation" && node.relation === "moves" && node.quantifier === "some") {
    const witness = graph.related(c, row, "moves").rows.find((move) =>
      evaluate(node.query, "moves", move, graph) === true);
    if (!witness) return [];
    const details = node.query.children.map((child) =>
      child.kind === "moveTrait"
        ? traitChoices.find(([id]) => id === child.trait)?.[1]
        : child.field === "power.value"
          ? `potencia ${witness.power?.value ?? "variable"}`
          : child.field === "priority"
            ? `prioridad ${witness.priority}`
            : child.field === "typeId"
              ? label("types", witness.typeId)
              : child.field === "category"
                ? translate(witness.category)
                : child.field === "id" ? "movimiento elegido" : summary(child, "moves"),
    ).filter(Boolean);
    return [`Aprende ${witness.name}${details.length ? ` · ${details.join(", ")}` : ""}`];
  }
  if (node.kind === "coverage") {
    const moves = graph.related("pokemon", row, "moves").rows.filter((move) =>
      ["physical", "special"].includes(move.category) &&
      move.power?.kind &&
      move.power?.kind !== "not-applicable" &&
      (move.power?.kind !== "fixed" || move.power.value > 0));
    const defenders = node.target === "all"
      ? graph.data.types : [graph.maps.types.get(node.target)].filter(Boolean);
    return defenders.map((defender) => {
      const witness = moves.map((move) => ({
        move, multiplier: graph.maps.types.get(move.typeId)?.effectiveness?.[defender.id],
      })).filter(({ multiplier }) => multiplier >= (node.target === "all" ? 1 : 2))
        .sort((a, b) => b.multiplier - a.multiplier)[0];
      return witness
        ? `Contra ${defender.name}: ${witness.move.name} (${label("types", witness.move.typeId)}, ${witness.multiplier}×)`
        : `Contra ${defender.name}: sin testigo conocido`;
    });
  }
  if (node.kind === "defense") {
    const attack = graph.maps.types.get(node.typeId);
    const multiplier = row.typeIds.reduce((value, typeId) => value * attack.effectiveness[typeId], 1);
    return [`${summary(node, c)}: daño de ${label("types", node.typeId)} ${multiplier}× sobre ${row.typeIds.map((id) => label("types", id)).join("/")}`];
  }
  if (node.kind === "condition") {
    if (node.field === "abilityIds") return [`Habilidad: ${node.value.map((id) => label("abilities", id)).join(", ")}`];
    if (node.field === "typeIds") return [`Tipo: ${node.value.map((id) => label("types", id)).join(", ")}`];
    if (node.field?.startsWith("stats.")) return [`${field(c, node.field).label}: ${fieldValue(row, node.field).value}`];
    return [summary(node, c)];
  }
  return [summary(node, c)];
}
function renderResults(result) {
  const s = state(),
    c = current;
  if (!result.possible.length && s.bucket === "possible") s.bucket = "confirmed";
  const rows = result[s.bucket];
  s.page = Math.max(1, Math.min(s.page, Math.ceil(rows.length / s.size) || 1));
  $("confirmed-count").textContent =
    result.confirmed.length.toLocaleString("es");
  $("possible-count").textContent = result.possible.length.toLocaleString("es");
  $("possible-tab").hidden = result.possible.length === 0;
  $("jump-results").textContent = `Ver ${result.confirmed.length.toLocaleString("es")} confirmados${result.possible.length ? ` · ${result.possible.length.toLocaleString("es")} sin verificar` : ""}`;
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
      : `${(result.scopeCount ?? database.data[c].length).toLocaleString("es")} ${c === 'pokemon' && !s.includeBattleForms ? 'formas de entrada' : 'registros'} de la captura de Champions`;
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
      `${titles[c]}: ${s.bucket === "confirmed" ? "coincidencias confirmadas" : "registros sin verificar"}`,
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
    const why = c === "pokemon" && s.bucket === "confirmed" && s.query.children.length
      ? el("details", { class: "why" }, el("summary", {}, "Por qué coincide"))
      : null;
    why?.addEventListener("toggle", () => {
      if (why.open && !why.querySelector("ul"))
        why.append(el("ul", {}, matchEvidence(s.query, c, row).map((line) => el("li", {}, line))));
    });
    const mobileReason = s.bucket === "possible"
      ? el("div", { class: "mobile-reason" }, undecided(s.query, c, row, graph).join(" · "))
      : null;
    const identity = c === 'pokemon'
      ? el('div', {class: 'pokemon-ident'},
          el('img', {
            class: 'pokemon-sprite',
            src: `./site/sprites/${row.id}.png`,
            alt: '', width: '44', height: '44', loading: 'lazy', decoding: 'async',
          }),
          el('div', {class: 'pokemon-name'},
            button(name(c, row), () => showDetail(c, row), {class: 'name-button'}),
            why, mobileReason))
      : [button(name(c, row), () => showDetail(c, row), {class: 'name-button'}), why, mobileReason];
    const tr = el(
      "tr",
      {},
      el(
        "td",
        {class: c === 'pokemon' ? 'pokemon-cell' : ''},
        identity,
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
              ? "Hay registros sin verificar; consulta su motivo antes de sacar conclusiones."
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
            el("td", {}, t.effectiveness?.[d.id] === undefined ? "Sin dato" : `${t.effectiveness[d.id]}×`),
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
  if (c === "pokemon") return openPokemonDetail(row);
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
        sources.replaceChildren(el("h3", {}, "Evidencias y campos sin dato"));
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
            el("h3", {}, "Sin dato o sin interpretación"),
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
      el("h3", {}, "Relaciones documentadas"),
      el(
        "p",
        { class: "help" },
        "La ficha indica qué listas están cerradas para esta captura; las relaciones abiertas no permiten descartar casos por ausencia.",
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
          el("h3", {}, "Pokémon capaces de provocar este efecto si se cumplen los requisitos"),
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
              "No hay productores documentados en el catálogo actual.",
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
      "Champout es la fuente principal. OP.GG, Showdown y los anuncios oficiales completan únicamente los 147 huecos autorizados, sin sustituir datos de champout. Cada campo conserva su evidencia; no se exige doble proveedor. La presencia en las tablas no certifica legalidad vigente ni actualidad del último parche.",
    ),
    el("p", {}, `Conjunto: ${database.manifest.datasetId}`),
    el(
      "p",
      {},
      "Los complementos incluyen efectividades, naturalezas, reglas generales y el reglamento oficial. La cobertura completa de todas las interacciones y excepciones de combate continúa pendiente; los datos desconocidos no se interpretan como imposibles.",
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
          "Campos publicados / esperados",
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
document.documentElement.dataset.theme = "dark";
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
$("jump-results").onclick = () => $("results").scrollIntoView({ behavior: "smooth", block: "start" });
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
$("pokemon-back").onclick = closePokemonDetail;
window.addEventListener("popstate", () => {
  const id = hashPokemonId();
  if (id) {
    const row = database?.data.pokemon?.find((item) => item.id === id);
    if (row) {
      if (current !== "pokemon") navigate("pokemon");
      openPokemonDetail(row, { push: false });
    }
  } else if (pokemonDetailId) hidePokemonDetail({ restoreFocus: true });
});
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
    const saved = history.state?.championsDB;
    if (saved?.query?.kind === "group" &&
      ["all", "any", "none"].includes(saved.query.mode) &&
      Array.isArray(saved.query.children) && saved.query.children.length <= 30 &&
      typeof saved.search === "string" && saved.search.length <= 200) {
      const restored = newState("pokemon");
      restored.query = clone(saved.query);
      restored.search = saved.search;
      restored.includeBattleForms = saved.includeBattleForms === true;
      if (Array.isArray(saved.columns)) restored.columns = saved.columns;
      if (Array.isArray(saved.sort)) restored.sort = saved.sort;
      if (Number.isInteger(saved.page) && saved.page > 0) restored.page = saved.page;
      if ([15, 25, 50, 100].includes(saved.size)) restored.size = saved.size;
      if (["confirmed", "possible"].includes(saved.bucket)) restored.bucket = saved.bucket;
      restored.matrix = saved.matrix === true;
      states.set("pokemon", restored);
    }
    $("workspace").hidden = false;
    $("version").textContent =
      `champout · ${database.manifest.context.revision.slice(0, 8)}`;
    navigate("pokemon");
    const id = hashPokemonId();
    if (id) {
      const row = database.data.pokemon.find((item) => item.id === id);
      if (row) openPokemonDetail(row, { push: false });
    }
  } catch (e) {
    error(e.message, start);
  }
}
start();
