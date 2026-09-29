import { isTeamEntryForm, entryFormId } from "./form-roles.mjs";

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child !== null && child !== undefined)
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
};
const statNames = [
  ["hp", "PS"], ["attack", "Ataque"], ["defense", "Defensa"],
  ["spAttack", "At. especial"], ["spDefense", "Def. especial"], ["speed", "Velocidad"],
];
const categoryNames = { physical: "Físico", special: "Especial", status: "Estado" };
const targetNames = {
  "selected-pokemon": "Pokémon seleccionado", "all-opponents": "Todos los rivales",
  "all-pokemon": "Todos los Pokémon", "all-other-pokemon": "Todos los demás Pokémon",
  "user": "Usuario", "user-or-ally": "Usuario o aliado", "user-and-allies": "Usuario y aliados",
  "ally": "Aliado", "all-allies": "Todos los aliados", "opponents-field": "Campo rival",
  "user-field": "Campo propio", "users-field": "Campo propio", "entire-field": "Todo el campo",
  "random-opponent": "Rival aleatorio", "special": "Objetivo especial",
};
const propertyNames = {
  contact: "Contacto", bite: "Mordisco", bullet: "Bala", coercion: "Coacción",
  dance: "Danza", explosion: "Explosión", healing: "Curación", powder: "Polvo",
  pulse: "Pulso", punch: "Puño", slicing: "Corte", sound: "Sonido", wind: "Viento",
};
const typeBadge = (type) => el("span", { class: "badge detail-type", "data-type": type.id }, type.name);
const choice = (label, values, onChange) => el("label", { class: "detail-select" },
  el("span", { class: "sr-only" }, label),
  el("select", { "aria-label": label, onchange: (event) => onChange(event.target.value) },
    values.map(([value, name]) => el("option", { value }, name))));
function numberFact(fact, unit = "") {
  if (fact?.kind === "fixed" || fact?.kind === "percent") return `${fact.value}${unit}`;
  if (fact?.kind === "not-applicable") return "—";
  if (fact?.kind === "variable") return "Variable";
  return "Sin dato";
}
function moveTable(moves, types, complete) {
  const section = el("section", { class: "pokemon-panel pokemon-moves", "aria-labelledby": "pokemon-moves-title" });
  const title = el("h2", { id: "pokemon-moves-title" }, `Movimientos (${moves.length})`);
  const filters = { search: "", category: "", type: "", priority: "", target: "", contact: "", sort: "name" };
  const resultCount = el("p", { class: "detail-move-count", "aria-live": "polite" });
  const wrap = el("div", { class: "detail-move-scroll" });
  const search = el("input", { type: "search", placeholder: "Buscar movimiento…", "aria-label": "Buscar movimiento" });
  const categoryBar = el("div", { class: "detail-filter-chips", role: "group", "aria-label": "Categoría del movimiento" });
  const typeBar = el("div", { class: "detail-filter-chips", role: "group", "aria-label": "Tipo del movimiento" });
  const categoryButtons = [["", "Todo"], ...Object.entries(categoryNames)];
  const typeIds = [...new Set(moves.map((move) => move.typeId))];
  const typeButtons = [["", "Todos los tipos"], ...types.filter((type) => typeIds.includes(type.id)).map((type) => [type.id, type.name])];
  function render() {
    for (const [bar, key] of [[categoryBar, "category"], [typeBar, "type"]])
      for (const button of bar.querySelectorAll("button"))
        button.setAttribute("aria-pressed", String(button.value === filters[key]));
    const found = moves.filter((move) =>
      (!filters.search || `${move.name} ${move.description || ""}`.toLocaleLowerCase("es").includes(filters.search)) &&
      (!filters.category || move.category === filters.category) &&
      (!filters.type || move.typeId === filters.type) &&
      (!filters.priority || String(move.priority) === filters.priority) &&
      (!filters.target || move.target === filters.target) &&
      (!filters.contact || String(move.properties?.contact === true) === filters.contact));
    found.sort((a, b) => filters.sort === "power"
      ? (b.power?.value || 0) - (a.power?.value || 0) || a.name.localeCompare(b.name, "es")
      : filters.sort === "priority"
        ? b.priority - a.priority || a.name.localeCompare(b.name, "es")
        : a.name.localeCompare(b.name, "es"));
    resultCount.textContent = `${found.length} de ${moves.length} movimientos${complete ? " confirmados para esta captura" : " documentados; la lista no está confirmada como completa"}`;
    const headings = ["Movimiento", "Tipo", "Categoría", "Propiedades", "Potencia", "Precisión", "PP", "Prioridad", "Objetivo"];
    const table = el("table", {}, el("caption", { class: "sr-only" }, "Movimientos disponibles para este Pokémon en Pokémon Champions"),
      el("thead", {}, el("tr", {}, headings.map((heading) => el("th", { scope: "col" }, heading)))));
    table.append(el("tbody", {}, found.map((move) => {
      const type = types.find((item) => item.id === move.typeId);
      const properties = Object.entries(move.properties || {}).filter(([, enabled]) => enabled === true)
        .map(([key]) => propertyNames[key] || key);
      return el("tr", {},
        el("td", {}, el("strong", {}, move.name), move.description && move.description !== "—"
          ? el("small", {}, move.description) : null),
        el("td", {}, type ? typeBadge(type) : "Sin dato"),
        el("td", {}, el("span", { class: `category-pill ${move.category}` }, categoryNames[move.category] || "Sin dato")),
        el("td", {}, properties.length ? properties.join(" · ") : "—"),
        el("td", {}, numberFact(move.power)), el("td", {}, numberFact(move.accuracy, "%")),
        el("td", {}, move.pp ?? "Sin dato"), el("td", {}, move.priority ?? "Sin dato"),
        el("td", {}, targetNames[move.target] || move.target || "Sin dato"));
    })));
    wrap.replaceChildren(found.length ? table : el("p", { class: "empty" }, "No hay movimientos que cumplan estos filtros."));
  }
  for (const [bar, values, key] of [[categoryBar, categoryButtons, "category"], [typeBar, typeButtons, "type"]])
    bar.append(...values.map(([value, name]) => {
      const node = el("button", { type: "button", onclick: () => { filters[key] = value; render(); } }, name);
      node.value = value;
      if (key === "type" && value) node.dataset.type = value;
      return node;
    }));
  search.addEventListener("input", () => { filters.search = search.value.toLocaleLowerCase("es").trim(); render(); });
  const priorities = [...new Set(moves.map((move) => move.priority))].sort((a, b) => b - a);
  const targets = [...new Set(moves.map((move) => move.target))].sort();
  section.append(title, categoryBar, typeBar,
    el("div", { class: "detail-move-controls" }, search,
      choice("Prioridad", [["", "Cualquier prioridad"], ...priorities.map((priority) => [String(priority), String(priority)])], (value) => { filters.priority = value; render(); }),
      choice("Objetivo", [["", "Cualquier objetivo"], ...targets.map((target) => [target, targetNames[target] || target])], (value) => { filters.target = value; render(); }),
      choice("Contacto", [["", "Contacto o sin contacto"], ["true", "Contacto"], ["false", "Sin contacto"]], (value) => { filters.contact = value; render(); }),
      choice("Ordenar movimientos", [["name", "Nombre"], ["power", "Potencia"], ["priority", "Prioridad"]], (value) => { filters.sort = value; render(); })),
    resultCount, wrap);
  render();
  return section;
}
export function renderPokemonDetail(container, row, graph, { openEntry }) {
  const types = graph.data.types || [];
  const abilities = row.abilityIds.map((id) => graph.maps.abilities.get(id)).filter(Boolean);
  const stats = statNames.map(([key]) => row.stats?.[key]);
  const total = stats.every(Number.isFinite) ? stats.reduce((sum, value) => sum + value, 0) : null;
  const effectiveness = types.map((attack) => ({
    type: attack,
    multiplier: row.typeIds.reduce((factor, defender) => factor * (attack.effectiveness?.[defender] ?? NaN), 1),
  })).filter(({ multiplier }) => Number.isFinite(multiplier));
  const groups = [
    ["Débil a", "weak", effectiveness.filter(({ multiplier }) => multiplier > 1)],
    ["Resistente a", "resist", effectiveness.filter(({ multiplier }) => multiplier > 0 && multiplier < 1)],
    ["Inmune a", "immune", effectiveness.filter(({ multiplier }) => multiplier === 0)],
  ];
  const entry = entryFormId(row) && graph.maps.pokemon.get(entryFormId(row));
  const knownMoves = graph.related("pokemon", row, "moves");
  const heading = el("h1", { id: "pokemon-detail-title" }, row.name);
  const identity = el("div", { class: "pokemon-detail-identity" },
    el("div", { class: "pokemon-detail-art" }, el("img", { src: `./site/sprites/${row.id}.png`, alt: `Imagen de ${row.name}`, width: "256", height: "256" })),
    el("h2", {}, row.name),
    el("div", { class: "pokemon-detail-types" }, row.typeIds.map((id) => types.find((type) => type.id === id)).filter(Boolean).map(typeBadge)),
    el("span", { class: "form-pill" }, row.form?.kind === "base" ? "Forma base" : row.form?.kind === "mega" ? "Mega Evolución" : "Forma de combate"));
  const statsPanel = el("div", { class: "pokemon-detail-stats" },
    el("div", { class: "detail-section-heading" }, el("h2", {}, "Estadísticas base"), total === null ? null : el("span", { class: "stat-total" }, `TOTAL ${total}`)),
    ...statNames.map(([key, name]) => {
      const value = row.stats?.[key];
      return el("div", { class: "stat-row" }, el("span", {}, name), el("strong", {}, Number.isFinite(value) ? value : "—"),
        el("span", { class: "stat-track" }, el("span", { class: "stat-fill", style: `width:${Number.isFinite(value) ? Math.min(100, value / 180 * 100) : 0}%` })));
    }));
  const matchups = el("div", { class: "pokemon-detail-matchups" }, el("h2", {}, "Efectividad defensiva"),
    el("p", { class: "muted" }, "Multiplicador del daño por tipo antes de habilidades y otros efectos."),
    ...groups.filter(([, , entries]) => entries.length).map(([title, className, entries]) =>
      el("div", { class: `matchup-group ${className}` }, el("h3", {}, title),
        el("div", { class: "matchup-list" }, entries.map(({ type, multiplier }) =>
          el("span", { class: "matchup-entry" }, typeBadge(type), el("strong", {}, `${multiplier}×`)))))));
  const overview = el("section", { class: "pokemon-panel pokemon-overview", "aria-label": "Resumen de combate" }, identity, statsPanel, matchups);
  const abilitiesPanel = el("section", { class: "pokemon-panel pokemon-abilities" }, el("h2", {}, "Habilidades"),
    el("div", { class: "ability-grid" }, abilities.map((ability) =>
      el("article", { class: "ability-card" }, el("h3", {}, ability.name),
        el("p", {}, ability.description && ability.description !== "—" ? ability.description : "Descripción no documentada.")))));
  const notice = !isTeamEntryForm(row) ? el("div", { class: "detail-combat-notice" },
    el("strong", {}, "Forma de combate"),
    el("p", {}, row.form?.kind === "mega"
      ? "Se obtiene mediante Mega Evolución durante el combate; no se selecciona directamente para el equipo."
      : "Para preparar el equipo, consulta los movimientos de la forma de entrada."),
    entry ? el("button", { type: "button", onclick: () => openEntry(entry) }, `Ver forma de entrada: ${entry.name}`) : null) : null;
  container.replaceChildren(...[heading, notice, overview, abilitiesPanel, moveTable(knownMoves.rows, types, knownMoves.complete)].filter(Boolean));
}
