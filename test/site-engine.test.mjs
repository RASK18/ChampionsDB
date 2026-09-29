import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createGraph,
  evaluate,
  queryRows,
  sortRows,
  fieldValue,
  countResult,
  undecided,
} from "../site/engine.mjs";
import { collections, buildCatalog, leafPaths } from "../site/catalog.mjs";
import { Database } from "../site/loader.mjs";
import { referenceText, displayValue } from "../site/engine.mjs";
const read = async (p) =>
  JSON.parse(await readFile(new URL("../" + p, import.meta.url), "utf8"));
const data = Object.fromEntries(
  await Promise.all(
    collections.map(async (c) => [c, await read(`data/${c}.json`)]),
  ),
);
const graph = createGraph(data);
test("referencias con el mismo ID distinguen tipo y condición de combate", () => {
  assert.equal(
    referenceText("types", "poison", graph),
    graph.maps.types.get("poison").name,
  );
  assert.equal(
    referenceText("effects", "poison", graph),
    graph.maps.effects.get("poison").name,
  );
  assert.equal(
    displayValue({ effectId: "poison" }, graph),
    `Efecto: ${graph.maps.effects.get("poison").name}`,
  );
});
const condition = (field, op, value) => ({
  kind: "condition",
  field,
  op,
  value,
});
const group = (mode, ...children) => ({ kind: "group", mode, children });
const relation = (key, query, quantifier = "some", extra = {}) => ({
  kind: "relation",
  relation: key,
  query,
  quantifier,
  ...extra,
});
test("catálogo cubre cada campo publicado, incluidas hojas dentro de requisitos", () => {
  const catalog = buildCatalog(data);
  for (const c of collections) {
    const paths = new Set(catalog[c].map((f) => f.path));
    for (const row of data[c])
      for (const path of leafPaths(row))
        assert.ok(paths.has(path), `${c}:${path}`);
  }
  assert.ok(
    catalog.interactions.some(
      (f) => f.path === "rule.requirements.all.*.predicate",
    ),
  );
});
test("todos los campos admiten una comparación exacta de sus valores reales, también las estructuras", () => {
  const catalog = buildCatalog(data);
  for (const c of collections)
    for (const f of catalog[c]) {
      const row = data[c].find((r) => fieldValue(r, f.path).status === "known");
      if (!row) continue;
      const value = fieldValue(row, f.path).value;
      const op = f.type === "list" ? "exact" : f.type === "enum" ? "in" : "eq";
      assert.equal(
        evaluate(
          condition(f.path, op, op === "in" ? [value] : value),
          c,
          row,
          graph,
        ),
        true,
        `${c}/${f.path}`,
      );
    }
});
test("lógica trivalente: negar desconocido no lo hace verdadero", () => {
  const unknown = condition("missing", "eq", 1),
    yes = condition("id", "eq", "x"),
    no = condition("id", "eq", "y"),
    row = { id: "x" };
  assert.equal(evaluate(group("none", unknown), "pokemon", row, graph), null);
  assert.equal(
    evaluate(group("all", unknown, no), "pokemon", row, graph),
    false,
  );
  assert.equal(
    evaluate(group("any", unknown, yes), "pokemon", row, graph),
    true,
  );
  assert.equal(evaluate(group("none", yes, no), "pokemon", row, graph), false);
  assert.equal(
    evaluate(condition("missing", "unknown"), "pokemon", row, graph),
    true,
  );
});
test("rangos inclusivos, listas, exclusiones, booleano falso y texto acentuado", () => {
  const r = {
    id: "x",
    types: ["water", "ground"],
    n: 80,
    flag: false,
    name: "Parálisis",
  };
  for (const q of [
    condition("n", "range", [80, 90]),
    condition("types", "every", ["ground", "water"]),
    condition("types", "none", ["fire"]),
    condition("types", "exact", ["ground", "water"]),
    condition("flag", "eq", false),
    condition("name", "contains", "PARALISIS"),
  ])
    assert.equal(evaluate(q, "pokemon", r, graph), true);
  assert.equal(
    evaluate(condition("types", "exact", ["water"]), "pokemon", r, graph),
    false,
  );
});
test("las condiciones de movimiento deben coincidir sobre el MISMO movimiento", () => {
  const sample = {
    pokemon: [{ id: "p", abilityIds: [] }],
    moves: [
      {
        id: "a",
        typeId: "water",
        category: "physical",
        power: { kind: "fixed", value: 90 },
      },
      {
        id: "b",
        typeId: "fire",
        category: "special",
        power: { kind: "fixed", value: 100 },
      },
    ],
    learnsets: [
      { id: "pa", pokemonId: "p", moveId: "a" },
      { id: "pb", pokemonId: "p", moveId: "b" },
    ],
  };
  const g = createGraph(sample, { relations: { "pokemon/p/moves": true } }),
    p = sample.pokemon[0];
  const water = condition("typeId", "eq", "water"),
    special = condition("category", "eq", "special");
  assert.equal(
    evaluate(relation("moves", group("all", water, special)), "pokemon", p, g),
    false,
  );
  assert.equal(
    evaluate(
      group("all", relation("moves", water), relation("moves", special)),
      "pokemon",
      p,
      g,
    ),
    true,
  );
});
test("Experto no combina multigolpe de potencia alta con otro movimiento débil", () => {
  const p = {id: "p", abilityIds: ["technician"]};
  const data = {
    pokemon: [p],
    moves: [
      {id: "move-042", category: "physical", power: {kind: "fixed", value: 100}},
      {id: "move-001", category: "physical", power: {kind: "fixed", value: 40}},
    ],
    learnsets: [{id: "a", pokemonId: "p", moveId: "move-042"}, {id: "b", pokemonId: "p", moveId: "move-001"}],
  };
  const graph = createGraph(data, {relations: {"pokemon/p/moves": true}});
  const search = group("all", condition("abilityIds", "some", ["technician"]),
    relation("moves", group("all", {kind: "moveTrait", trait: "multihit"}, condition("power.value", "lte", 60))));
  assert.equal(evaluate(search, "pokemon", p, graph), false);
  data.moves[0].power.value = 25;
  assert.equal(evaluate(search, "pokemon", p, createGraph(data)), true);
});
test("Arbok queda posible sin atribuirle un movimiento de cambio", () => {
  const arbok = data.pokemon.find((row) => row.name === "Arbok");
  const pivot = relation("moves", group("all", {kind: "moveTrait", trait: "pivot"}));
  const learned = graph.related("pokemon", arbok, "moves");
  assert.equal(learned.complete, false);
  assert.equal(evaluate(pivot, "pokemon", arbok, graph), null);
  assert.match(undecided(pivot, "pokemon", arbok, graph).join(" "),
    new RegExp(`Ninguno de sus ${learned.rows.length} movimientos documentados es de cambio`));
});
test("ausencia de aprendizaje abierta; conjuntos vacíos certificados y todos no vacuo", () => {
  const p = { id: "p", typeIds: [], abilityIds: [] };
  const g = createGraph({ pokemon: [p] });
  assert.equal(
    evaluate(relation("moves", group("all"), "none"), "pokemon", p, g),
    null,
  );
  assert.equal(
    evaluate(relation("types", group("all"), "none"), "pokemon", p, g),
    true,
  );
  assert.equal(
    evaluate(relation("types", group("all"), "all"), "pokemon", p, g),
    false,
  );
  assert.ok(
    undecided(relation("moves", group("all"), "none"), "pokemon", p, g).length,
  );
});
test("cantidades parciales: límites, igualdad, exclusión y umbrales", () => {
  assert.equal(countResult(3, Infinity, "gte", 2), true);
  assert.equal(countResult(3, Infinity, "eq", 3), null);
  assert.equal(countResult(3, Infinity, "lte", 2), false);
  assert.equal(countResult(0, Infinity, "ne", 5), null);
  assert.equal(countResult(3, 3, "eq", 3), true);
  assert.equal(countResult(3, Infinity, "range", [0, 2]), false);
});
test("una retirada explícita cierra esa pareja sin declarar completo el resto de aprendizajes", () => {
  const p = { id: "politoed" };
  const g = createGraph(
    { pokemon: [p] },
    { excluded: ["learnsets/politoed--pound"] },
  );
  assert.equal(
    evaluate(
      relation("moves", condition("id", "eq", "pound"), "none"),
      "pokemon",
      p,
      g,
    ),
    true,
  );
  assert.equal(
    evaluate(
      relation("moves", condition("id", "eq", "pound")),
      "pokemon",
      p,
      g,
    ),
    false,
  );
  assert.equal(
    evaluate(
      relation("moves", condition("id", "eq", "other"), "none"),
      "pokemon",
      p,
      g,
    ),
    null,
  );
});
test("potencia variable, no aplicable y naturalezas neutras conservan significado", () => {
  assert.equal(
    fieldValue(
      { rule: { endTurnDamageFraction: [1, 16] } },
      "rule.endTurnDamageFraction",
    ).value,
    0.0625,
  );
  assert.equal(
    fieldValue({ power: { kind: "variable" } }, "power.value").status,
    "variable",
  );
  assert.equal(
    fieldValue({ accuracy: { kind: "not-applicable" } }, "accuracy.value")
      .status,
    "na",
  );
  assert.equal(
    evaluate(
      condition("increased", "na"),
      "natures",
      { id: "neutral-fixture", increased: null },
      graph,
    ),
    true,
  );
});
test("cobertura ofensiva exige testigos aprendidos y conserva la ausencia abierta", () => {
  const ids = ["water", "electric", "steel", "ground", ...Array.from({length: 14}, (_, i) => `type-${i}`)];
  const types = ids.map((id) => ({
    id,
    effectiveness: Object.fromEntries(ids.map((other) => [other, 1])),
  }));
  types[0].effectiveness.steel = 2;
  types[0].effectiveness.ground = 0;
  types[1].effectiveness.steel = 0.5;
  const p = {id: "p", typeIds: ["steel"]};
  const moves = [{id: "water-move", typeId: "water", category: "special", power: {kind: "fixed", value: 80}}, {id: "electric-move", typeId: "electric", category: "special", power: {kind: "fixed", value: 80}}, {id: "status-move", typeId: "water", category: "status", power: {kind: "not-applicable"}}];
  const make = (moveId, complete = false) => createGraph({
    types, pokemon: [p], moves,
    learnsets: [{id: "learn", pokemonId: "p", moveId}],
  }, complete ? {relations: {"pokemon/p/moves": true}} : {});
  assert.equal(evaluate({kind: "coverage", target: "steel"}, "pokemon", p, make("water-move")), true);
  assert.equal(evaluate({kind: "coverage", target: "steel"}, "pokemon", p, make("electric-move")), null);
  assert.equal(evaluate({kind: "coverage", target: "steel"}, "pokemon", p, make("electric-move", true)), false);
  assert.equal(evaluate({kind: "coverage", target: "steel"}, "pokemon", p, make("status-move", true)), false);
  assert.equal(evaluate({kind: "coverage", target: "all"}, "pokemon", p, make("water-move")), null);
  assert.equal(evaluate({kind: "coverage", target: "all"}, "pokemon", p, make("water-move", true)), false);
  const neutral = {id: "neutral", typeId: "steel", category: "physical", power: {kind: "fixed", value: 50}};
  const complete = createGraph({types, pokemon: [p], moves: [neutral], learnsets: [{id: "n", pokemonId: "p", moveId: "neutral"}]});
  assert.equal(evaluate({kind: "coverage", target: "all"}, "pokemon", p, complete), true);
});
test("defensa combina los tipos y distingue resistencia de inmunidad", () => {
  const types = [
    {id: "water", effectiveness: {steel: 0.5, flying: 1, ground: 2}},
    {id: "electric", effectiveness: {steel: 1, flying: 2, ground: 0}},
    {id: "steel"}, {id: "flying"}, {id: "ground"},
  ];
  const g = createGraph({types});
  const p = {id: "p", typeIds: ["steel", "flying"]};
  const q = {id: "q", typeIds: ["ground", "flying"]};
  const check = (row, typeId, mode) => evaluate({kind: "defense", typeId, mode}, "pokemon", row, g);
  assert.equal(check(p, "water", "resist"), true);
  assert.equal(check(p, "water", "immune"), false);
  assert.equal(check(p, "electric", "weak"), true);
  assert.equal(check(p, "water", "weak"), false);
  assert.equal(check(q, "water", "weak"), true);
  assert.equal(check(q, "electric", "immune"), true);
  assert.equal(check(q, "electric", "resist"), false);
  assert.equal(check({id: "pending"}, "water", "resist"), null);
  assert.equal(check(p, "unknown", "resist"), null);
});
test("rasgos de movimiento usan la clasificación revisada y su alcance estrecho", () => {
  const check = (move, trait) => evaluate({kind: "moveTrait", trait}, "moves", move, graph);
  assert.equal(check({id: "move-369"}, "pivot"), true);
  assert.equal(check({id: "move-863"}, "pivot"), false);
  assert.equal(check({id: "move-042"}, "multihit"), true);
  assert.equal(check({id: "other", properties: {coercion: true}}, "control"), true);
  assert.equal(check({id: "other", properties: {coercion: false}}, "control"), false);
  assert.equal(check({id: "other"}, "undocumented"), null);
});
test("ordenación múltiple estable antes de paginar; desconocidos al final en ambos sentidos", () => {
  const rows = [
    { id: "z", power: { kind: "variable" } },
    { id: "x" },
    { id: "a", power: { kind: "fixed", value: 80 } },
    { id: "b", power: { kind: "fixed", value: 10 } },
    { id: "n", power: { kind: "not-applicable" } },
  ];
  assert.deepEqual(
    sortRows(
      rows,
      [{ field: "power.value", direction: "asc" }],
      "moves",
      graph,
    ).map((r) => r.id),
    ["b", "a", "z", "n", "x"],
  );
  assert.deepEqual(
    sortRows(
      rows,
      [{ field: "power.value", direction: "desc" }],
      "moves",
      graph,
    ).map((r) => r.id),
    ["a", "b", "z", "n", "x"],
  );
  const ties = [
    { id: "b", v: 1, name: "Árbol" },
    { id: "a", v: 1, name: "árbol" },
    { id: "c", v: 0, name: "Zeta" },
  ];
  assert.deepEqual(
    sortRows(
      ties,
      [
        { field: "v", direction: "asc" },
        { field: "name", direction: "desc" },
      ],
      "moves",
      graph,
    ).map((r) => r.id),
    ["c", "a", "b"],
  );
});
test("Lluvia separa vías directas, beneficios y copia condicionada", () => {
  const rain = data.effects.find((e) => e.id === "rain");
  const r = graph.related("effects", rain, "producers");
  assert.ok(r.rows.length > 0);
  for (const paths of Object.values(r.paths))
    for (const path of paths) {
      assert.equal(path.kind, "direct");
      assert.notEqual(path.via.id, "ability-033");
    }
  const indirect = graph.related("effects", rain, "producers", {
    includeIndirect: true,
  });
  assert.ok(
    Object.values(indirect.paths)
      .flat()
      .some(
        (p) =>
          p.kind === "indirect" &&
          p.eligibility === "conditional-not-evaluated",
      ),
  );
});
test("relaciones inversas, selectores de tipos, bayas, formas y estados", () => {
  const p = data.pokemon.find((p) => p.abilityIds?.length);
  const a = graph.maps.abilities.get(p.abilityIds[0]);
  assert.ok(
    graph.related("abilities", a, "pokemon").rows.some((x) => x.id === p.id),
  );
  const water = data.moves.find((m) => m.typeId === "water");
  assert.ok(
    graph
      .related("moves", water, "interactions")
      .rows.some(
        (i) => i.rule.source.id === "rain" && i.rule.relation === "boosts",
      ),
  );
  assert.ok(graph.index.berries().records.length);
  assert.ok(graph.index.megaStones().records.length);
  assert.ok(graph.index.conditions().records.length);
  assert.ok(
    graph.related("species", graph.maps.species.get("species-003"), "forms")
      .rows.length > 1,
  );
});
test("Pokémon enlaza interacciones cuyo movimiento aprendido coincide con un selector", () => {
  const pokemon = {id: "p", abilityIds: []};
  const move = {id: "water-move", typeId: "water"};
  const interaction = {
    id: "rain-boosts-water", rule: {
      relation: "boosts",
      source: {collection: "effects", id: "rain"},
      target: {collection: "moves", selector: {typeId: "water"}},
    },
  };
  const g = createGraph({
    pokemon: [pokemon], moves: [move],
    learnsets: [{id: "learn", pokemonId: "p", moveId: "water-move"}],
    effects: [{id: "rain"}], interactions: [interaction],
  });
  assert.deepEqual(g.related("pokemon", pokemon, "interactions").rows.map((r) => r.id), [interaction.id]);
  assert.deepEqual(g.related("pokemon", pokemon, "effects").rows.map((r) => r.id), ["rain"]);
});
test("consultas con más de 21.000 aprendizajes y separación confirmados/posibles", () => {
  assert.ok(data.learnsets.length > 21000);
  const q = relation("moves", condition("name", "contains", "lluvia"));
  const result = queryRows(data.pokemon, "pokemon", q, "", [], graph);
  assert.ok(result.confirmed.length);
  assert.ok(result.possible.length);
  assert.equal(
    result.confirmed.length + result.possible.length,
    data.pokemon.length,
  );
});
test("cargador rechaza mezcla de generaciones y recupera descargas fallidas", async () => {
  const payload = JSON.stringify([{ id: "x" }]),
    hash = createHash("sha256").update(payload).digest("hex");
  let attempts = 0;
  const db = new Database(
    new URL("https://example.test/ChampionsDB/"),
    async () => {
      attempts++;
      return new Response(attempts < 3 ? "[]" : payload);
    },
  );
  db.manifest = { files: { "data/types.json": { sha256: hash } } };
  await assert.rejects(db.read("data/types.json"), /publicaciones diferentes/);
  assert.equal(attempts, 2);
  assert.deepEqual(await db.read("data/types.json"), [{ id: "x" }]);
});
