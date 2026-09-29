import { isTeamEntryForm } from "./form-roles.mjs";
import { categoryNames, targetNames, propertyNames, typeBadge, numberFact, statNames } from "./pokemon-detail.mjs";

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined) node.setAttribute(key, value);
  }
  for (const child of children.flat())
    if (child !== null && child !== undefined)
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};
const filtersByMove = new Map();
const statShort = { hp: "PS", attack: "Atq.", defense: "Def.", spAttack: "At. esp.", spDefense: "Def. esp.", speed: "Vel." };
function typeMatchups(pokemon, types) {
  const entries = types.map((attack) => ({
    type: attack,
    factor: pokemon.typeIds.reduce((factor, defenseId) => factor * (attack.effectiveness?.[defenseId] ?? NaN), 1),
  })).filter(({ factor }) => Number.isFinite(factor));
  const chips = (items) => items.map(({ type, factor }) =>
    el("span", { class: "move-matchup-chip", title: `${type.name}: ${factor}×` }, typeBadge(type), el("strong", {}, `${factor}×`)));
  return {
    weak: chips(entries.filter(({ factor }) => factor > 1)),
    resist: chips(entries.filter(({ factor }) => factor < 1)),
  };
}
function renderPokemonTable(section, rows, graph, moveId, openPokemon, complete) {
  const types = graph.data.types;
  const filters = filtersByMove.get(moveId) || { search: "", type: "", form: "all", sort: "name" };
  filtersByMove.set(moveId, filters);
  const search = el("input", { type: "search", "aria-label": "Buscar Pokémon que aprende este movimiento", placeholder: "Buscar Pokémon o habilidad…" });
  search.value = filters.search;
  const typeSelect = el("select", { "aria-label": "Filtrar Pokémon por tipo" },
    el("option", { value: "" }, "Todos los tipos"),
    types.filter((type) => rows.some((row) => row.typeIds.includes(type.id)))
      .map((type) => el("option", { value: type.id }, type.name)));
  typeSelect.value = filters.type;
  const formSelect = el("select", { "aria-label": "Filtrar formas de Pokémon" },
    el("option", { value: "all" }, "Todas las formas"),
    el("option", { value: "entry" }, "Formas de entrada"),
    el("option", { value: "battle" }, "Formas de combate"));
  formSelect.value = filters.form;
  const sortSelect = el("select", { "aria-label": "Ordenar Pokémon" },
    el("option", { value: "name" }, "Nombre"),
    el("option", { value: "speed" }, "Velocidad"),
    el("option", { value: "total" }, "Total de estadísticas"),
    el("option", { value: "attack" }, "Ataque"));
  sortSelect.value = filters.sort;
  const count = el("p", { class: "move-users-count", "aria-live": "polite" });
  const wrap = el("div", { class: "move-users-scroll" });
  function render() {
    const found = rows.filter((pokemon) => {
      const abilities = pokemon.abilityIds.map((id) => graph.maps.abilities.get(id)?.name || "").join(" ");
      return (!filters.search || `${pokemon.name} ${abilities}`.toLocaleLowerCase("es").includes(filters.search.toLocaleLowerCase("es"))) &&
        (!filters.type || pokemon.typeIds.includes(filters.type)) &&
        (filters.form === "all" || (filters.form === "entry") === isTeamEntryForm(pokemon));
    });
    const total = (pokemon) => {
      const values = statNames.map(([key]) => pokemon.stats?.[key]);
      return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    found.sort((a, b) => filters.sort === "speed"
      ? (b.stats.speed ?? -1) - (a.stats.speed ?? -1) || a.name.localeCompare(b.name, "es")
      : filters.sort === "total"
        ? (total(b) ?? -1) - (total(a) ?? -1) || a.name.localeCompare(b.name, "es")
        : filters.sort === "attack"
          ? (b.stats.attack ?? -1) - (a.stats.attack ?? -1) || a.name.localeCompare(b.name, "es")
          : a.name.localeCompare(b.name, "es"));
    count.textContent = `${found.length} de ${rows.length} Pokémon${complete ? " confirmados para esta captura" : " documentados; la lista no está confirmada como completa"}`;
    const headings = ["Pokémon", "Tipos", ...statNames.map(([key]) => statShort[key]), "Total", "Débil a", "Resiste / inmune", "Habilidades"];
    const table = el("table", {}, el("caption", { class: "sr-only" }, "Pokémon que aprenden este movimiento en Pokémon Champions"),
      el("thead", {}, el("tr", {}, headings.map((heading) => el("th", { scope: "col" }, heading)))));
    table.append(el("tbody", {}, found.map((pokemon) => {
      const matchups = typeMatchups(pokemon, types);
      const pokemonTypes = pokemon.typeIds.map((id) => graph.maps.types.get(id)).filter(Boolean);
      const abilities = pokemon.abilityIds.map((id) => graph.maps.abilities.get(id)?.name).filter(Boolean);
      return el("tr", {},
        el("td", { class: "move-user-name" }, el("span", { class: "move-user-ident" },
          el("img", { src: `./site/sprites/${pokemon.id}.png`, alt: "", width: "62", height: "62", loading: "lazy", decoding: "async" }),
          el("span", {}, el("button", { type: "button", class: "detail-row-link", onclick: () => openPokemon(pokemon) }, pokemon.name),
            !isTeamEntryForm(pokemon) ? el("small", {}, pokemon.form?.kind === "mega" ? "Mega Evolución" : "Forma de combate") : null))),
        el("td", {}, el("span", { class: "move-user-types" }, pokemonTypes.map(typeBadge))),
        ...statNames.map(([key]) => el("td", { class: "move-user-stat" }, pokemon.stats?.[key] ?? "—")),
        el("td", { class: "move-user-stat total" }, total(pokemon) ?? "—"),
        el("td", {}, el("span", { class: "move-user-matchups" }, matchups.weak.length ? matchups.weak : "—")),
        el("td", {}, el("span", { class: "move-user-matchups" }, matchups.resist.length ? matchups.resist : "—")),
        el("td", { class: "move-user-abilities" }, abilities.length ? abilities.join(" · ") : "—"));
    })));
    wrap.replaceChildren(found.length ? table : el("p", { class: "empty" }, "No hay Pokémon que cumplan estos filtros."));
  }
  search.addEventListener("input", () => { filters.search = search.value; render(); });
  typeSelect.addEventListener("change", () => { filters.type = typeSelect.value; render(); });
  formSelect.addEventListener("change", () => { filters.form = formSelect.value; render(); });
  sortSelect.addEventListener("change", () => { filters.sort = sortSelect.value; render(); });
  section.append(el("h2", {}, `Pokémon que pueden aprenderlo (${rows.length})`),
    el("div", { class: "move-user-controls" }, search, typeSelect, formSelect, sortSelect), count, wrap);
  render();
}
export function renderMoveDetail(container, move, graph, { openPokemon }) {
  const type = graph.maps.types.get(move.typeId);
  const related = graph.related("moves", move, "pokemon");
  const properties = Object.entries(move.properties || {}).filter(([, enabled]) => enabled === true)
    .map(([key]) => propertyNames[key] || key);
  const summary = el("section", { class: "move-summary pokemon-panel" },
    el("div", { class: "move-summary-heading" },
      el("h1", { id: "move-detail-title" }, move.name),
      type ? typeBadge(type) : el("span", { class: "muted" }, "Tipo sin dato"),
      el("span", { class: `category-pill ${move.category}` }, categoryNames[move.category] || "Categoría sin dato")),
    el("dl", { class: "move-facts" },
      [["Potencia", numberFact(move.power)], ["Precisión", numberFact(move.accuracy, "%")],
        ["PP", move.pp ?? "Sin dato"], ["Prioridad", move.priority ?? "Sin dato"],
        ["Objetivo", targetNames[move.target] || move.target || "Sin dato"],
        ["Propiedades", properties.length ? properties.join(" · ") : "Ninguna documentada"]]
        .map(([name, value]) => el("div", {}, el("dt", {}, name), el("dd", {}, value)))),
    move.description && move.description !== "—" ? el("p", { class: "move-description" }, move.description) : null,
    el("p", { class: "move-summary-count" }, `${related.rows.length} Pokémon${related.complete ? " confirmados para esta captura" : " documentados; lista no confirmada como completa"}`));
  const users = el("section", { class: "pokemon-panel move-users", "aria-label": "Pokémon que aprenden el movimiento" });
  renderPokemonTable(users, related.rows, graph, move.id, openPokemon, related.complete);
  container.replaceChildren(summary, users);
}
