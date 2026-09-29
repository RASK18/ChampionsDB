import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moveTraits, moveTraitDefinitions, reviewedMoveId } from "../site/move-tags.mjs";

const moves = JSON.parse(readFileSync(new URL("../data/moves.json", import.meta.url)));
const byId = new Map(moves.map((move) => [move.id, move]));
const traits = (number) => moveTraits(byId.get(`move-${String(number).padStart(3, "0")}`));

test("movimientos reales de cambio; revivir o transferir estados no equivale a pivotar", () => {
  for (const number of [369, 521, 575, 812, 881]) {
    assert.equal(traits(number).pivot, true, byId.get(`move-${number}`)?.name);
  }
  for (const number of [226, 863, 880]) {
    assert.equal(traits(number).pivot, false, `move-${number}`);
  }
  assert.equal(moves.filter((move) => moveTraits(move).pivot).length, 5);
});

test("multigolpe usa el movimiento concreto, incluidos dos golpes y potencia creciente", () => {
  for (const number of [42, 350, 813, 814, 860, 888]) {
    assert.equal(traits(number).multihit, true, `move-${number}`);
  }
  assert.equal(traits(369).multihit, false);
  assert.equal(moves.filter((move) => moveTraits(move).multihit).length, 14);
  const hitsWithLowPower = moves.filter(
    (move) => moveTraits(move).multihit && move.power?.kind === "fixed" && move.power.value <= 60,
  );
  assert.ok(hitsWithLowPower.some((move) => move.name === "Pedrada"));
  assert.ok(hitsWithLowPower.every((move) => moveTraits(move).multihit));
});

test("control tiene alcance explícito y procede de la propiedad coercion de champout", () => {
  const controls = moves.filter((move) => moveTraits(move).control);
  assert.deepEqual(
    controls.map((move) => move.name).sort(),
    ["Anulación", "Atracción", "Mofa", "Otra Vez", "Tormento"].sort(),
  );
  assert.equal(traits(196).control, false); // Viento Hielo: control de velocidad, otra función.
  assert.equal(traits(86).control, false); // Onda Trueno: estado alterado, otra función.
  assert.match(moveTraitDefinitions.control.description, /Anulación/);
});

test("todos los movimientos publicados tienen IDs y propiedad de control explícitos", () => {
  assert.equal(moves.length, 512);
  for (const move of moves) {
    assert.match(move.id, /^move-\d{3}$/);
    assert.equal(reviewedMoveId(move.id), true, `Revisar rasgos de ${move.id} antes de publicar`);
    assert.equal(typeof move.properties?.coercion, "boolean", move.id);
    const result = moveTraits(move);
    for (const value of Object.values(result)) assert.equal(typeof value, "boolean");
  }
  assert.equal(moveTraits({id: "move-999", properties: {coercion: false}}).pivot, undefined);
  assert.equal(moveTraits({id: "move-999", properties: {coercion: false}}).multihit, undefined);
});
