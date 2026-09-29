// A closed learnset is a claim about one captured Champions masterdata revision.
// It does not certify the current regulation or a future game update.
const moveId = (number) => `move-${String(Number(number)).padStart(3, '0')}`;

export function certifyLearnsets({ tables, data, excluded, snapshot, cosmetic = [] }) {
  const source = 'champout/masterdata/waza_learn';
  const learnRows = new Map(tables[source].map((row) => [row.id, row]));
  const sourceMoves = new Map(
    tables['champout/masterdata/waza'].map((row) => [Number(row.id), row]),
  );
  const publishedPokemon = new Set(data.pokemon.map((row) => row.id));
  const publishedMoves = new Set(data.moves.map((row) => row.id));
  const publishedPairs = new Set(data.learnsets.map((row) => row.id));
  const excludedPairs = new Set(
    excluded.filter((row) => row.entity.startsWith('learnsets/')).map((row) => row.entity.slice(10)),
  );
  const cosmeticPokemon = new Set(cosmetic.map((row) => row.id));
  const validSourcePokemon = tables['champout/masterdata/personal'].filter((row) => row.is_valid === '1');

  if (learnRows.size !== tables[source].length)
    throw new Error('Duplicate captured learnset row');
  if (sourceMoves.size !== tables['champout/masterdata/waza'].length)
    throw new Error('Duplicate captured move row');
  if (new Set(validSourcePokemon.map((row) => row.id)).size !== validSourcePokemon.length)
    throw new Error('Duplicate valid Champions Pokemon row');

  for (const row of validSourcePokemon) {
    const id = `pokemon-${row.id}`;
    if (!learnRows.has(row.id)) throw new Error(`Missing captured learnset: ${id}`);
    if (!publishedPokemon.has(id) && !cosmeticPokemon.has(id))
      throw new Error(`Unaccounted valid Champions Pokemon: ${id}`);
  }
  for (const pokemon of data.pokemon) {
    const rawId = pokemon.id.slice('pokemon-'.length);
    const learn = learnRows.get(rawId);
    if (!learn) throw new Error(`Missing captured learnset: ${pokemon.id}`);
    const numbers = learn.waza.split(',').map(Number);
    if (new Set(numbers).size !== numbers.length)
      throw new Error(`Duplicate captured move: ${pokemon.id}`);
    for (const number of numbers) {
      const sourceMove = sourceMoves.get(number);
      if (!sourceMove) throw new Error(`Unknown captured move: ${pokemon.id}/${number}`);
      const id = `${pokemon.id}--${moveId(number)}`;
      if (sourceMove.available === '1') {
        if (!publishedMoves.has(moveId(number)) || !publishedPairs.has(id) || excludedPairs.has(id))
          throw new Error(`Unpublished available learnset: ${id}`);
        publishedPairs.delete(id);
      } else if (sourceMove.available === '0') {
        if (!excludedPairs.has(id) || publishedPairs.has(id))
          throw new Error(`Unexplained unavailable learnset: ${id}`);
        excludedPairs.delete(id);
      } else throw new Error(`Unknown move availability: ${number}`);
    }
  }
  if (publishedPairs.size || excludedPairs.size)
    throw new Error(`Unexpected learnsets: ${publishedPairs.size} published, ${excludedPairs.size} excluded`);
  for (const sourceMove of sourceMoves.values()) {
    const id = moveId(sourceMove.id);
    if ((sourceMove.available === '1') !== publishedMoves.has(id))
      throw new Error(`Move catalogue differs from captured availability: ${id}`);
  }

  const relations = {};
  for (const pokemon of data.pokemon)
    for (const relation of ['moves', 'learnsets']) relations[`pokemon/${pokemon.id}/${relation}`] = true;
  for (const move of data.moves)
    for (const relation of ['pokemon', 'learnsets']) relations[`moves/${move.id}/${relation}`] = true;
  return {
    scope: 'Listas de aprendizaje y catálogo de movimientos de la revisión capturada de Pokémon Champions; no acredita reglamento ni parche posterior.',
    source,
    revision: snapshot.revisions.champout,
    sha256: snapshot.documents[source].sha256,
    relations,
  };
}
