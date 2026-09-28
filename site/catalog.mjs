export const collections = [
  "types",
  "species",
  "pokemon",
  "learnsets",
  "moves",
  "abilities",
  "items",
  "effects",
  "interactions",
  "natures",
  "battle-rules",
  "regulations",
];
export const fractionPaths = new Set([
  "rule.firstTurnDamageFraction",
  "rule.incrementPerTurn",
  "rule.endTurnDamageFraction",
]);
export const titles = {
  pokemon: "Pokémon",
  species: "Especies",
  moves: "Movimientos",
  abilities: "Habilidades",
  items: "Objetos",
  effects: "Efectos",
  types: "Tipos",
  natures: "Naturalezas",
  interactions: "Interacciones",
  "battle-rules": "Reglas generales",
  regulations: "Reglamentos",
  learnsets: "Aprendizajes",
};
export const words = {
  name: "Nombre",
  description: "Descripción",
  typeId: "Tipo",
  typeIds: "Tipos",
  abilityIds: "Habilidades",
  speciesId: "Especie",
  pokemonId: "Pokémon",
  moveId: "Movimiento",
  effectId: "Efecto",
  itemId: "Objeto",
  nationalDex: "N.º Pokédex",
  form: "Forma",
  kind: "Clase",
  sex: "Sexo",
  weightKg: "Peso (kg)",
  stats: "Estadísticas",
  hp: "PS",
  attack: "Ataque",
  defense: "Defensa",
  spAttack: "At. especial",
  spDefense: "Def. especial",
  speed: "Velocidad",
  category: "Categoría",
  power: "Potencia",
  accuracy: "Precisión (%)",
  value: "Valor",
  pp: "PP efectivos",
  priority: "Prioridad",
  target: "Objetivo",
  properties: "Propiedades",
  contact: "Contacto",
  sound: "Sonido",
  punch: "Puño",
  bite: "Mordisco",
  bullet: "Bala",
  pulse: "Pulso",
  dance: "Danza",
  wind: "Viento",
  slicing: "Cortante",
  effectiveness: "Efectividad contra",
  increased: "Sube",
  decreased: "Baja",
  multipliers: "Multiplicadores",
  rule: "Regla",
  rules: "Reglas",
  source: "Origen",
  relation: "Relación",
  trigger: "Desencadenante",
  recipient: "Destinatario",
  requirements: "Requisitos",
  restrictions: "Restricciones",
  parameters: "Parámetros",
  duration: "Duración",
  turns: "Turnos",
  multiplier: "Multiplicador",
  stat: "Estadística",
  selector: "Selector",
  property: "Propiedad",
  collection: "Colección",
  id: "Referencia",
  usesPerBattle: "Usos por combate",
  additionalTurns: "Turnos adicionales",
  probability: "Probabilidad",
  all: "Todas",
  any: "Alguna",
  not: "No",
  predicate: "Condición",
  subject: "Sujeto",
  validFrom: "Inicio",
  validUntil: "Fin",
  date: "Fecha",
  precision: "Precisión de fecha",
  playerTimeSeconds: "Tiempo por jugador (s)",
  teamPreviewSeconds: "Vista del equipo (s)",
  turnTimeSeconds: "Tiempo por turno (s)",
  firstTurnDamageFraction: "Daño inicial (fracción)",
  incrementPerTurn: "Incremento por turno",
  resetOnSwitch: "Reinicio al cambiar",
  endTurnDamageFraction: "Daño al final del turno",
  physicalDamageMultiplier: "Multiplicador de daño físico",
  forcedThawTurn: "Turno de descongelación forzada",
  thawProbability: "Probabilidad de descongelarse",
  failureProbability: "Probabilidad de fallar",
  speedMultiplier: "Multiplicador de velocidad",
  firstTurnAsleep: "Duerme el primer turno",
  forcedWakeTurn: "Turno de despertar forzado",
  restWakeTurn: "Turno de despertar de Descanso",
  secondTurnWakeChanceDisplayedPercent:
    "Probabilidad mostrada de despertar en segundo turno (%)",
  base: "Base",
  mega: "Mega",
  regional: "Regional",
  alternate: "Alternativa",
  gender: "Diferencia por sexo",
  mixed: "Ambos sexos",
  female: "Hembra",
  male: "Macho",
  genderless: "Sin sexo",
  physical: "Físico",
  special: "Especial",
  status: "Estado",
  weather: "Clima",
  terrain: "Terreno",
  volatile: "Estado volátil",
  field: "Campo",
  team: "Equipo",
  other: "Otro",
  berry: "Baya",
  "mega-stone": "Megapiedra",
  "held-item": "Objeto equipado",
  fixed: "Fija",
  variable: "Variable",
  "not-applicable": "No aplicable",
  percent: "Porcentaje",
  day: "Día",
  causes: "Provoca",
  cures: "Cura",
  prevents: "Impide",
  extends: "Prolonga",
  suppresses: "Suprime",
  boosts: "Potencia",
  reduces: "Reduce",
  activates: "Activa",
  benefits: "Se beneficia",
  transforms: "Transforma",
  copies: "Copia",
  modifies: "Modifica",
  "selected-pokemon": "Pokémon seleccionado",
  user: "Usuario",
  "random-opponent": "Rival aleatorio",
  "all-other-pokemon": "Los demás Pokémon",
  "all-opponents": "Todos los rivales",
  "users-field": "Campo propio",
  "entire-field": "Todo el campo",
  "opponents-field": "Campo rival",
  "user-or-ally": "Usuario o aliado",
  ally: "Aliado",
  "all-pokemon": "Todos los Pokémon",
  "all-allies": "Todos los aliados",
  self: "Uno mismo",
  holder: "Portador",
  "matching-moves": "Movimientos coincidentes",
  "on-entry": "Al entrar",
  "while-active": "Mientras esté activo",
  "damage-calculation": "Al calcular daño",
  "on-status": "Al sufrir un estado",
  "mega-evolution": "Al megaevolucionar",
  "on-effect-created": "Al crear el efecto",
  "on-hit": "Al golpear",
  "on-use": "Al usar",
  "attempt-move": "Al intentar actuar",
  "effect-active": "Efecto activo",
  "source-is-opponent": "El origen es un rival",
  "form-is": "Forma requerida",
  "holds-item": "Objeto equipado",
  "created-by-holder": "Creado por el portador",
  "ability-active": "Habilidad activa",
  "move-succeeds": "El movimiento tiene éxito",
  grounded: "En el suelo",
  "type-is": "Tipo requerido",
  chance: "Probabilidad",
  "status-is": "Estado requerido",
  copyable: "Copiable",
  "opponent-has-copyable-source": "El rival tiene un origen copiable",
  "copied-source-activates": "El origen copiado se activa",
  bug: "Bicho",
  dark: "Siniestro",
  dragon: "Dragón",
  electric: "Eléctrico",
  fairy: "Hada",
  fighting: "Lucha",
  fire: "Fuego",
  flying: "Volador",
  ghost: "Fantasma",
  grass: "Planta",
  ground: "Tierra",
  ice: "Hielo",
  normal: "Normal",
  poison: "Veneno",
  psychic: "Psíquico",
  rock: "Roca",
  steel: "Acero",
  water: "Agua",
};
export const translate = (value) =>
  words[value] ?? titles[value] ?? String(value);
export const referenceFields = {
  typeId: "types",
  typeIds: "types",
  abilityIds: "abilities",
  speciesId: "species",
  pokemonId: "pokemon",
  moveId: "moves",
  effectId: "effects",
  itemId: "items",
};
export function referenceCollection(row, path) {
  if (path === "rule.source.id") return row?.rule?.source?.collection;
  if (path === "rule.target.id") return row?.rule?.target?.collection;
  return referenceFields[path.split(".").at(-1)];
}
export const pathLabel = (path) =>
  ({
    "form.kind": "Forma",
    "power.value": "Potencia",
    "accuracy.value": "Precisión (%)",
  })[path] ||
  (path.startsWith("stats.")
    ? translate(path.slice(6))
    : path
        .split(".")
        .filter((p) => p !== "*")
        .map(translate)
        .join(" · "));
export const defaults = {
  pokemon: [
    "name",
    "form.kind",
    "typeIds",
    "abilityIds",
    "stats.hp",
    "stats.attack",
    "stats.defense",
    "stats.spAttack",
    "stats.spDefense",
    "stats.speed",
  ],
  moves: [
    "name",
    "typeId",
    "category",
    "power.value",
    "accuracy.value",
    "pp",
    "priority",
  ],
  abilities: ["name", "description"],
  items: ["name", "category", "description"],
  effects: ["name", "category", "description"],
  types: ["name"],
  species: ["name", "nationalDex"],
  learnsets: ["pokemonId", "moveId"],
  natures: [
    "name",
    "increased",
    "decreased",
    "multipliers.increased",
    "multipliers.decreased",
  ],
  interactions: [
    "rule.source.id",
    "rule.relation",
    "rule.target.id",
    "rule.trigger",
    "rule.recipient",
  ],
  "battle-rules": ["name"],
  regulations: ["name", "validFrom.date", "validUntil.date"],
};
export const operators = {
  text: ["contains", "notContains", "eq", "starts"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "range"],
  boolean: ["eq"],
  enum: ["in", "notIn"],
  list: ["some", "every", "none", "exact"],
};
export const opLabels = {
  contains: "Contiene",
  notContains: "No contiene",
  eq: "Igual a",
  ne: "Distinto de",
  starts: "Empieza por",
  gt: "Mayor que",
  gte: "Mayor o igual",
  lt: "Menor que",
  lte: "Menor o igual",
  range: "Entre (inclusive)",
  in: "Incluir alguno",
  notIn: "Excluir todos",
  some: "Contiene alguno",
  every: "Contiene todos",
  none: "No contiene ninguno",
  exact: "Conjunto exacto",
  known: "Está verificado",
  unknown: "Está pendiente",
  na: "No aplicable",
};
export function readPath(row, path) {
  const walk = (v, parts) => {
    if (!parts.length) return v;
    const [p, ...rest] = parts;
    if (p === "*")
      return Array.isArray(v)
        ? v.flatMap((x) => {
            const r = walk(x, rest);
            return r === undefined ? [] : Array.isArray(r) ? r : [r];
          })
        : undefined;
    return v == null ? undefined : walk(v[p], rest);
  };
  return walk(row, path.split("."));
}
export function leafPaths(value, prefix = "", result = new Set()) {
  if (Array.isArray(value)) {
    if (prefix) result.add(prefix);
    for (const v of value)
      if (v && typeof v === "object") leafPaths(v, `${prefix}.*`, result);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value))
      if (prefix || !["id", "identity", "available"].includes(k))
        leafPaths(v, prefix ? `${prefix}.${k}` : k, result);
  } else if (prefix) result.add(prefix);
  return result;
}
export function buildCatalog(data, schemas = {}) {
  return Object.fromEntries(
    collections.map((c) => {
      const paths = new Set(defaults[c]);
      for (const row of data[c] || []) leafPaths(row, "", paths);
      function schemaPaths(s, p = "") {
        if (s.properties)
          for (const [k, v] of Object.entries(s.properties)) {
            if (!p && ["id", "available", "identity"].includes(k)) continue;
            schemaPaths(v, p ? `${p}.${k}` : k);
          }
        else if (p && !s.$ref) paths.add(p);
      }
      if (schemas[c]) schemaPaths(schemas[c].items);
      const fields = [...paths].sort().map((path) => {
        const values = (data[c] || []).flatMap((row) => {
          const v = readPath(row, path);
          return v === undefined ? [] : [v];
        });
        const first = values.find((v) => v !== null);
        const isList = values.some(Array.isArray);
        const type = fractionPaths.has(path)
          ? "number"
          : isList
            ? "list"
            : typeof first === "number"
              ? "number"
              : typeof first === "boolean"
                ? "boolean"
                : path === "name" || path === "description"
                  ? "text"
                  : "enum";
        const options = [
          ...new Map(
            values
              .flat()
              .filter((v) => v !== undefined && v !== null)
              .map((v) => [JSON.stringify(v), v]),
          ).values(),
        ].sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b), "es"),
        );
        return { path, label: pathLabel(path), type, options };
      });
      return [c, fields];
    }),
  );
}
