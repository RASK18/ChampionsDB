// Etiquetas para explorar posibilidades, no recomendaciones de sets.
// Los números son los IDs de movimiento de champout. Las listas de cambio y
// multigolpe se contrastaron con `selfSwitch` y `multihit` del pokemon-showdown
// 0.11.11 instalado como dependencia de desarrollo; el navegador no lo carga.
// Se excluye Plegaria Vital (863): Showdown marca selfSwitch, pero su efecto
// revive a un compañero y no cambia al usuario. Relevo y Muda Cola también
// quedan fuera: transfieren estados/sustituto, no son cambios de posición puros.
const pivotIds = new Set([
  "move-369", // Ida y Vuelta
  "move-521", // Voltiocambio
  "move-575", // Última Palabra
  "move-812", // Viraje
  "move-881", // Fría Acogida
]);

const multihitIds = new Set([
  "move-042", "move-198", "move-331", "move-333", "move-350",
  "move-458", "move-541", "move-594", "move-751", "move-799",
  "move-813", "move-814", "move-860", "move-888",
]);

// Bitset de los 512 IDs revisados en la captura actual de data/moves.json.
// Un movimiento nuevo queda indeterminado hasta contrastar sus rasgos; la
// prueba de cobertura obliga a revisar este bitset cuando cambie el catálogo.
const reviewedIdsHex = "82531c026dd4248f3af6ebdea62b1ec120a381333ee1dcbdfd9ff998ed5cfffdfbf55b7f088ebfae6effbf7999f35f987bf7ffffff5bffd73c06e0d7ddfff9b72bbef36c0019f5bdf31e7c340b0200000000f03bd91f6f006c18000000de1300809fbdf4ffff005cd63ee0f6e5077fffc00a7f";
export function reviewedMoveId(id) {
  const number = /^move-(\d+)$/.exec(id || "")?.[1];
  if (number === undefined) return false;
  const index = Math.floor(Number(number) / 8) * 2;
  if (index >= reviewedIdsHex.length) return false;
  return (parseInt(reviewedIdsHex.slice(index, index + 2), 16) & (1 << (Number(number) % 8))) !== 0;
}

export const moveTraitDefinitions = Object.freeze({
  pivot: {
    label: "Movimiento de cambio",
    description: "El usuario sale del combate y entra un compañero tras usarlo.",
    source: "Showdown 0.11.11, selfSwitch; lista revisada contra la descripción española de champout",
  },
  multihit: {
    label: "Multigolpe",
    description: "Un mismo uso golpea más de una vez.",
    source: "Showdown 0.11.11, multihit; IDs contrastados con champout",
  },
  control: {
    label: "Limita las acciones del rival",
    description: "Fuerza o impide acciones mediante Anulación, Atracción, Otra Vez, Tormento o Mofa.",
    source: "champout, properties.coercion",
  },
});

// `control` tiene un alcance deliberadamente estrecho: no incluye estados,
// bajadas de Velocidad, redirección ni protección. Esos efectos requerirían
// etiquetas separadas para no sugerir que todos actúan de la misma forma.
export function moveTraits(move) {
  const id = move?.id;
  const reviewed = reviewedMoveId(id);
  return {
    pivot: reviewed ? pivotIds.has(id) : undefined,
    multihit: reviewed ? multihitIds.has(id) : undefined,
    control: typeof move?.properties?.coercion === "boolean" ? move.properties.coercion : undefined,
  };
}
