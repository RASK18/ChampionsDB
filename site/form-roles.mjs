// Reviewed against the Champions forms in champout and Showdown's battleOnly/
// changesFrom form metadata. Mega Evolution takes place during battle.
// https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts
// https://champions-news.pokemon-home.com/en/page/816.html
const battleOnlyAlternates = new Set([
  'pokemon-0351001', 'pokemon-0351002', 'pokemon-0351003', // Castform weather
  'pokemon-0681001', // Aegislash Blade
  'pokemon-0778001', // Mimikyu Busted
  'pokemon-0877001', // Morpeko Hangry
  'pokemon-0964001', // Palafin Hero
]);

export function isTeamEntryForm(pokemon) {
  return pokemon.form?.kind !== 'mega' && !battleOnlyAlternates.has(pokemon.id);
}

export function entryFormId(pokemon) {
  if (!battleOnlyAlternates.has(pokemon.id)) return null;
  return `${pokemon.id.slice(0, -3)}000`;
}
