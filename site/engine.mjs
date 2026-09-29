import {
  collections,
  readPath,
  translate,
  fractionPaths,
  referenceFields,
  referenceCollection,
} from "./catalog.mjs";
import { createIndexes } from "../lib/queries.mjs";
import { moveTraits } from "./move-tags.mjs";
export const UNKNOWN = null;
export const fold = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .trim();
const and = (xs) =>
  xs.includes(false) ? false : xs.includes(null) ? null : true;
const or = (xs) =>
  xs.includes(true) ? true : xs.includes(null) ? null : false;
const negate = (x) => (x === null ? null : !x);
export const relationDefs = {
  pokemon: {
    species: "species",
    types: "types",
    abilities: "abilities",
    moves: "moves",
    learnsets: "learnsets",
    interactions: "interactions",
    effects: "effects",
  },
  species: { forms: "pokemon" },
  types: { pokemon: "pokemon", moves: "moves" },
  moves: {
    pokemon: "pokemon",
    types: "types",
    learnsets: "learnsets",
    interactions: "interactions",
    effects: "effects",
  },
  abilities: {
    pokemon: "pokemon",
    interactions: "interactions",
    effects: "effects",
  },
  items: { interactions: "interactions", effects: "effects", forms: "pokemon" },
  effects: {
    interactions: "interactions",
    moves: "moves",
    abilities: "abilities",
    items: "items",
    producers: "pokemon",
  },
  interactions: {
    source: "*",
    target: "*",
    effects: "effects",
    moves: "moves",
    abilities: "abilities",
    items: "items",
    pokemon: "pokemon",
  },
  learnsets: { pokemon: "pokemon", moves: "moves" },
  "battle-rules": { effects: "effects" },
  regulations: {},
  natures: {},
};
export const relationLabels = {
  species: "Especie",
  types: "Tipos",
  abilities: "Habilidades",
  moves: "Movimientos",
  learnsets: "Aprendizajes",
  interactions: "Interacciones",
  effects: "Efectos relacionados",
  forms: "Formas",
  pokemon: "Pokémon",
  items: "Objetos",
  source: "Origen",
  target: "Objetivo",
  producers: "Productores del efecto",
};
export function createGraph(data, coverage = {}) {
  const full = Object.fromEntries(collections.map((c) => [c, data[c] || []]));
  const maps = Object.fromEntries(
    collections.map((c) => [c, new Map(full[c].map((r) => [r.id, r]))]),
  );
  const index = createIndexes(full, coverage);
  const cache = new Map();
  const memo = new Map();
  const reverse = (name, rows, key) => {
    const map = new Map();
    for (const r of rows)
      for (const k of [].concat(key(r) || [])) {
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(r);
      }
    cache.set(name, map);
  };
  reverse("learn-p", full.learnsets, (r) => r.pokemonId);
  reverse("learn-m", full.learnsets, (r) => r.moveId);
  reverse("ability-p", full.pokemon, (r) => r.abilityIds);
  reverse("type-p", full.pokemon, (r) => r.typeIds);
  reverse("type-m", full.moves, (r) => r.typeId);
  reverse("species-p", full.pokemon, (r) => r.speciesId);
  const lookup = (c, ids) =>
    []
      .concat(ids || [])
      .map((id) => maps[c].get(id))
      .filter(Boolean);
  const back = (k, id) => cache.get(k)?.get(id) || [];
  function matches(ref, c, r) {
    if (ref?.collection !== c) return false;
    if (ref.id) return ref.id === r.id;
    const sel = ref.selector;
    if (!sel) return false;
    return Object.entries(sel).every(([k, v]) =>
      k === "property" ? r.properties?.[v] === true : r[k] === v,
    );
  }
  function resolve(ref) {
    if (!ref?.collection) return [];
    if (ref.id) return lookup(ref.collection, ref.id);
    return full[ref.collection].filter((r) => matches(ref, ref.collection, r));
  }
  function related(
    c,
    row,
    key,
    { includeIndirect = false, targetCollection } = {},
  ) {
    const token = JSON.stringify([
      c,
      row.id,
      key,
      includeIndirect,
      targetCollection,
    ]);
    if (memo.has(token)) return memo.get(token);
    let rows = [],
      complete = false,
      paths;
    const interactionRows = () =>
      full.interactions.filter(
        (i) => matches(i.rule.source, c, row) || matches(i.rule.target, c, row),
      );
    if (c === "pokemon") {
      if (key === "species") {
        rows = lookup("species", row.speciesId);
        complete = !!row.speciesId;
      }
      if (key === "types" || key === "abilities") {
        const field = key === "types" ? "typeIds" : "abilityIds";
        rows = lookup(key, row[field]);
        complete =
          Array.isArray(row[field]) && rows.length === row[field].length;
      }
      if (key === "learnsets") rows = back("learn-p", row.id);
      if (key === "moves")
        rows = lookup(
          "moves",
          back("learn-p", row.id).map((l) => l.moveId),
        );
      if (key === "interactions" || key === "effects") {
        const known = [
          ["pokemon", row],
          ...lookup("abilities", row.abilityIds).map((r) => ["abilities", r]),
          ...lookup("moves", back("learn-p", row.id).map((l) => l.moveId)).map((r) => ["moves", r]),
        ];
        rows = full.interactions.filter(
          (i) => known.some(([collection, record]) =>
            matches(i.rule.source, collection, record) ||
            matches(i.rule.target, collection, record),
          ),
        );
        if (key === "effects")
          rows = rows.flatMap((i) =>
            [i.rule.source, i.rule.target]
              .filter((r) => r.collection === "effects")
              .flatMap(resolve),
          );
      }
    } else if (c === "species" && key === "forms")
      rows = back("species-p", row.id);
    else if (c === "types")
      rows = back(key === "pokemon" ? "type-p" : "type-m", row.id);
    else if (c === "moves" && key === "pokemon")
      rows = lookup(
        "pokemon",
        back("learn-m", row.id).map((l) => l.pokemonId),
      );
    else if (c === "moves" && key === "learnsets")
      rows = back("learn-m", row.id);
    else if (c === "moves" && key === "types") {
      rows = lookup("types", row.typeId);
      complete = !!row.typeId;
    } else if (c === "abilities" && key === "pokemon")
      rows = back("ability-p", row.id);
    else if (c === "learnsets") {
      const field = key === "pokemon" ? "pokemonId" : "moveId";
      rows = lookup(key, row[field]);
      complete = !!row[field];
    } else if (c === "battle-rules") rows = lookup("effects", row.id);
    else if (c === "effects" && key === "producers") {
      const found = index.producersOfEffect(row.id, { includeIndirect });
      rows = found.records.map((r) => r.pokemon);
      paths = Object.fromEntries(
        found.records.map((r) => [r.pokemon.id, r.paths]),
      );
    } else if (c === "interactions") {
      if (key === "source" || key === "target") {
        rows = resolve(row.rule[key]);
        complete = !!row.rule[key].id;
      } else
        rows = [row.rule.source, row.rule.target]
          .filter((r) => r.collection === key)
          .flatMap(resolve);
      if (targetCollection)
        rows = rows.filter((r) => maps[targetCollection]?.has(r.id));
    } else if (key === "interactions") rows = interactionRows();
    else if (key === "forms" && c === "items")
      rows = interactionRows()
        .filter((i) => i.rule.relation === "transforms")
        .flatMap((i) => resolve(i.rule.target));
    else
      rows = interactionRows().flatMap((i) =>
        [i.rule.source, i.rule.target]
          .filter((r) => r.collection === key)
          .flatMap(resolve),
      );
    const result = {
      rows: [...new Map(rows.map((r) => [r.id, r])).values()],
      complete:
        complete || coverage.relations?.[`${c}/${row.id}/${key}`] === true,
      paths,
    };
    memo.set(token, result);
    return result;
  }
  return {
    data: full,
    maps,
    index,
    related,
    coverage,
    excluded: new Set(coverage.excluded || []),
  };
}
export function fieldValue(row, path) {
  const v = readPath(row, path);
  if (
    fractionPaths.has(path) &&
    Array.isArray(v) &&
    v.length === 2 &&
    v[1] !== 0
  )
    return { status: "known", value: v[0] / v[1], fraction: v };
  if (path === "power.value" || path === "accuracy.value") {
    const tag = row[path.split(".")[0]]?.kind;
    if (tag === "not-applicable") return { status: "na" };
    if (tag === "variable") return { status: "variable" };
  }
  return v === undefined
    ? { status: "unknown" }
    : v === null
      ? { status: "na" }
      : { status: "known", value: v };
}
function compare(v, op, w) {
  switch (op) {
    case "eq":
      if ((v && typeof v === "object") || (w && typeof w === "object")) {
        const canonical = (x) =>
          x && typeof x === "object"
            ? Array.isArray(x)
              ? x.map(canonical)
              : Object.fromEntries(
                  Object.keys(x)
                    .sort()
                    .map((k) => [k, canonical(x[k])]),
                )
            : x;
        return JSON.stringify(canonical(v)) === JSON.stringify(canonical(w));
      }
      return typeof v === "number" || typeof v === "boolean"
        ? v === w
        : fold(v) === fold(w);
    case "ne":
      return !compare(v, "eq", w);
    case "gt":
      return v > w;
    case "gte":
      return v >= w;
    case "lt":
      return v < w;
    case "lte":
      return v <= w;
    case "range":
      return v >= w[0] && v <= w[1];
    case "contains":
      return fold(v).includes(fold(w));
    case "notContains":
      return !compare(v, "contains", w);
    case "starts":
      return fold(v).startsWith(fold(w));
    case "in":
      return w.some((x) => compare(v, "eq", x));
    case "notIn":
      return !compare(v, "in", w);
    case "some":
      return w.some((x) => v.some((y) => compare(y, "eq", x)));
    case "every":
      return w.every((x) => v.some((y) => compare(y, "eq", x)));
    case "none":
      return !compare(v, "some", w);
    case "exact":
      return v.length === w.length && compare(v, "every", w);
    default:
      throw new Error(`Operador desconocido: ${op}`);
  }
}
export function countResult(min, max, op, value) {
  const hi =
    max === Infinity
      ? min +
        Math.max(1, Math.abs((Array.isArray(value) ? value[1] : value) || 0)) +
        1
      : max;
  // Evaluate every boundary on which a numeric comparison can change.
  const bounds = [
    min,
    hi,
    ...[]
      .concat(value)
      .flatMap((v) => [v - 1, v, v + 1])
      .filter((v) => v >= min && v <= max),
  ];
  const answers = bounds.map((v) => compare(v, op, value));
  return answers.every(Boolean)
    ? true
    : answers.every((x) => !x)
      ? false
      : null;
}
function pokemonCoverage(row, target, graph) {
  const learned = graph.related("pokemon", row, "moves");
  const defenders = target === "all"
    ? graph.data.types
    : [graph.maps.types.get(target)].filter(Boolean);
  if (!defenders.length) return null;
  let unknown = !learned.complete;
  const attackTypes = new Map();
  for (const move of learned.rows) {
    if (move.category === "status" || move.power?.kind === "not-applicable") continue;
    if (!["physical", "special"].includes(move.category) || !move.power?.kind ||
      (move.power.kind === "fixed" && !(move.power.value > 0))) {
      unknown = true;
      continue;
    }
    const attackType = graph.maps.types.get(move.typeId);
    if (attackType) attackTypes.set(attackType.id, attackType);
    else unknown = true;
  }
  const checks = defenders.map((defender) => {
    for (const attackType of attackTypes.values()) {
      const multiplier = attackType?.effectiveness?.[defender.id];
      if (typeof multiplier !== "number") continue;
      if (target === "all" ? multiplier >= 1 : multiplier > 1) return true;
    }
    return unknown || [...attackTypes.values()].some((type) =>
      typeof type.effectiveness?.[defender.id] !== "number") ? null : false;
  });
  // A claim about every type needs the complete defensive type catalogue.
  if (target === "all" && graph.data.types.length !== 18) checks.push(null);
  return and(checks);
}
function pokemonDefense(row, typeId, mode, graph) {
  if (!["resist", "immune", "weak"].includes(mode)) return null;
  if (!Array.isArray(row.typeIds)) return null;
  const attackType = graph.maps.types.get(typeId);
  if (!attackType) return null;
  const factors = row.typeIds.map((id) => attackType.effectiveness?.[id]);
  if (factors.includes(0)) return mode === "immune";
  if (factors.some((factor) => typeof factor !== "number")) return null;
  const multiplier = factors.reduce((value, factor) => value * factor, 1);
  return mode === "immune" ? false : mode === "weak" ? multiplier > 1 : multiplier > 0 && multiplier < 1;
}
export function evaluate(node, c, row, graph) {
  if (!node) return true;
  if (node.kind === "moveTrait") {
    const value = c === "moves" ? moveTraits(row)[node.trait] : undefined;
    return typeof value === "boolean" ? value : null;
  }
  if (node.kind === "coverage")
    return c === "pokemon" ? pokemonCoverage(row, node.target, graph) : null;
  if (node.kind === "defense")
    return c === "pokemon"
      ? pokemonDefense(row, node.typeId, node.mode, graph)
      : null;
  if (node.kind === "group") {
    const values = node.children.map((n) => evaluate(n, c, row, graph));
    return node.mode === "any"
      ? or(values)
      : node.mode === "none"
        ? negate(or(values))
        : and(values);
  }
  if (node.kind === "relation") {
    const target = node.targetCollection || relationDefs[c][node.relation];
    const r = graph.related(c, row, node.relation, node);
    const checks = r.rows.map((x) => evaluate(node.query, target, x, graph));
    // Two-source explicit removals close only the requested pair, never the whole learnset.
    const q = node.query;
    const requested =
      q?.kind === "condition" && q.field === "id"
        ? q.op === "eq"
          ? [q.value]
          : q.op === "in"
            ? q.value
            : null
        : null;
    const explicitlyAbsent =
      requested?.length > 0 &&
      requested.every((id) => {
        const pair =
          c === "pokemon" && node.relation === "moves"
            ? `${row.id}--${id}`
            : c === "moves" && node.relation === "pokemon"
              ? `${id}--${row.id}`
              : null;
        return pair && graph.excluded.has(`learnsets/${pair}`);
      });
    if (explicitlyAbsent) {
      if (node.quantifier === "count")
        return countResult(0, 0, node.op || "gte", node.value ?? 1);
      return node.quantifier === "none";
    }
    if (node.quantifier === "count") {
      const min = checks.filter((x) => x === true).length,
        max = r.complete ? checks.filter((x) => x !== false).length : Infinity;
      return countResult(min, max, node.op || "gte", node.value ?? 1);
    }
    const exists = checks.includes(true)
      ? true
      : r.complete && !checks.includes(null)
        ? false
        : null;
    if (node.quantifier === "none") return negate(exists);
    if (node.quantifier === "all")
      return checks.includes(false)
        ? false
        : r.complete
          ? checks.length
            ? and(checks)
            : false
          : null;
    return exists;
  }
  const { status, value } = fieldValue(row, node.field);
  if (node.op === "unknown") return status === "unknown";
  if (node.op === "known") return status === "known" || status === "variable";
  if (node.op === "na") return status === "na";
  if (status === "unknown" || status === "variable") return null;
  if (status === "na") return false;
  return compare(value, node.op, node.value);
}
export function undecided(node, c, row, graph) {
  if (evaluate(node, c, row, graph) !== null) return [];
  if (node.kind === "group")
    return node.children.flatMap((n) => undecided(n, c, row, graph));
  if (node.kind === "relation" && c === "pokemon" && node.relation === "moves" && node.quantifier === "some") {
    const related = graph.related(c, row, "moves");
    const checks = related.rows.map((move) => evaluate(node.query, "moves", move, graph));
    if (!checks.includes(true) && !checks.includes(null) && !related.complete) {
      const only = node.query.kind === "group" && node.query.children.length === 1
        ? node.query.children[0] : node.query;
      const criterion = only.kind === "moveTrait" && only.trait === "pivot"
        ? "es de cambio" : "cumple todas las propiedades solicitadas";
      return [`Ninguno de sus ${related.rows.length} movimientos documentados ${criterion}; la lista de aprendizajes no está confirmada como completa.`];
    }
    if (checks.includes(null))
      return ["Faltan propiedades confirmadas de algunos movimientos o aprendizajes por documentar."];
  }
  return [
    node.kind === "moveTrait"
      ? "Rasgo de movimiento sin clasificar"
      : node.kind === "coverage"
      ? "Cobertura ofensiva: aprendizajes o efectividades incompletos"
      : node.kind === "defense"
        ? "Defensa: tipos o efectividades incompletos"
        : node.kind === "relation"
      ? `Relación «${relationLabels[node.relation]}»: cobertura o condiciones incompletas`
      : `Campo «${node.field}» pendiente o variable`,
  ];
}
const collator = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});
export function displayValue(value, graph) {
  if (Array.isArray(value))
    return value.map((v) => displayValue(v, graph)).join(", ");
  if (value && typeof value === "object") {
    if (value.collection && value.id)
      return `${translate(value.collection)}: ${graph?.maps[value.collection]?.get(value.id)?.name || value.id}`;
    if (
      Object.keys(value).length === 1 &&
      Array.isArray(value.all) &&
      value.all.length === 0
    )
      return "Sin requisitos adicionales enumerados";
    return Object.entries(value)
      .map(
        ([k, v]) =>
          `${translate(k)}: ${referenceFields[k] ? referenceText(referenceFields[k], v, graph) : displayValue(v, graph)}`,
      )
      .join("; ");
  }
  if (value === true) return "Sí";
  if (value === false) return "No";
  if (value === null) return "No modifica";
  if (value === undefined) return "Sin dato";
  if (typeof value === "string" && graph) {
    for (const map of Object.values(graph.maps)) {
      const r = map.get(value);
      if (r?.name) return r.name;
    }
  }
  return translate(value);
}
export function referenceText(collection, value, graph) {
  return []
    .concat(value)
    .map((id) => graph?.maps[collection]?.get(id)?.name || id)
    .join(", ");
}
export function sortRows(rows, criteria, c, graph) {
  function val(r, s) {
    if (!s.relation) {
      const value = fieldValue(r, s.field),
        ref = referenceCollection(r, s.field);
      return value.status === "known" && ref && s.aggregate !== "count"
        ? {
            ...value,
            value: Array.isArray(value.value)
              ? value.value
                  .map((id) => referenceText(ref, id, graph))
                  .sort(collator.compare)
                  .join(", ")
              : referenceText(ref, value.value, graph),
          }
        : value;
    }
    const rel = graph.related(c, r, s.relation, s);
    if (s.aggregate === "count")
      return { status: "known", value: rel.rows.length };
    const values = rel.rows
      .map((x) => fieldValue(x, s.field))
      .filter((v) => v.status === "known")
      .map((v) => v.value);
    return values.length
      ? {
          status: "known",
          value:
            s.aggregate === "min" ? Math.min(...values) : Math.max(...values),
        }
      : { status: "unknown" };
  }
  const computed = new Map(
    rows.map((r) => [r.id, criteria.map((s) => val(r, s))]),
  );
  const rank = { known: 0, variable: 1, na: 2, unknown: 3 };
  return [...rows].sort((a, b) => {
    for (let i = 0; i < criteria.length; i++) {
      const x = computed.get(a.id)[i],
        y = computed.get(b.id)[i],
        s = criteria[i];
      if (x.status !== y.status) return rank[x.status] - rank[y.status];
      if (x.status !== "known") continue;
      const aa =
          s.aggregate === "count" && Array.isArray(x.value)
            ? x.value.length
            : x.value,
        bb =
          s.aggregate === "count" && Array.isArray(y.value)
            ? y.value.length
            : y.value;
      const text = (v) =>
        Array.isArray(v)
          ? v
              .map((x) => displayValue(x, graph))
              .sort(collator.compare)
              .join(", ")
          : displayValue(v, graph);
      const d =
        typeof aa === "number" && typeof bb === "number"
          ? aa - bb
          : collator.compare(text(aa), text(bb));
      if (d) return s.direction === "desc" ? -d : d;
    }
    return collator.compare(a.id, b.id);
  });
}
export function queryRows(rows, c, query, search, sort, graph) {
  const confirmed = [],
    possible = [];
  for (const row of rows) {
    if (
      search &&
      !fold(
        `${row.name || displayValue(row.id, graph)} ${row.description || ""}`,
      ).includes(fold(search))
    )
      continue;
    const v = evaluate(query, c, row, graph);
    if (v === true) confirmed.push(row);
    else if (v === null) possible.push(row);
  }
  return {
    confirmed: sortRows(confirmed, sort, c, graph),
    possible: sortRows(possible, sort, c, graph),
  };
}
