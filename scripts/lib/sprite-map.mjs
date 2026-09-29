const special = {
  'pokemon-0128001': 'tauros-paldeacombat',
  'pokemon-0128002': 'tauros-paldeablaze',
  'pokemon-0128003': 'tauros-paldeaaqua',
  'pokemon-0351001': 'castform-sunny',
  'pokemon-0351002': 'castform-rainy',
  'pokemon-0351003': 'castform-snowy',
  'pokemon-0479001': 'rotom-heat',
  'pokemon-0479002': 'rotom-wash',
  'pokemon-0479003': 'rotom-frost',
  'pokemon-0479004': 'rotom-fan',
  'pokemon-0479005': 'rotom-mow',
  'pokemon-0666000': 'vivillon-polar',
  'pokemon-0666018': 'vivillon-fancy',
  'pokemon-0670005': 'floette-eternal',
  'pokemon-0670006': 'floette-mega',
  'pokemon-0678001': 'meowstic-f',
  'pokemon-0678002': 'meowstic-mmega',
  'pokemon-0678003': 'meowstic-fmega',
  'pokemon-0681001': 'aegislash-blade',
  'pokemon-0711001': 'gourgeist-small',
  'pokemon-0711002': 'gourgeist-large',
  'pokemon-0711003': 'gourgeist-super',
  'pokemon-0745001': 'lycanroc-midnight',
  'pokemon-0745002': 'lycanroc-dusk',
  'pokemon-0778001': 'mimikyu-busted',
  'pokemon-0849001': 'toxtricity-lowkey',
  'pokemon-0876001': 'indeedee-f',
  'pokemon-0877001': 'morpeko-hangry',
  'pokemon-0902001': 'basculegion-f',
  'pokemon-0925000': 'maushold',
  'pokemon-0925001': 'maushold-four',
  'pokemon-0931001': 'squawkabilly-blue',
  'pokemon-0931002': 'squawkabilly-yellow',
  'pokemon-0931003': 'squawkabilly-white',
  'pokemon-0964001': 'palafin-hero',
};

// These Champions Megas are in PokéAPI's sprite set but not in Showdown's gen5 index.
export const pokeApiSpriteIds = {
  'pokemon-0026002': 10304,
  'pokemon-0026003': 10305,
  'pokemon-0398001': 10308,
  'pokemon-0545001': 10288,
  'pokemon-0560001': 10289,
  'pokemon-0604001': 10290,
  'pokemon-0668001': 10295,
  'pokemon-0687001': 10297,
  'pokemon-0689001': 10298,
  'pokemon-0691001': 10299,
  'pokemon-0870001': 10303,
};

const normal = (value) => value.normalize('NFKD').toLowerCase()
  .replace(/\p{Mark}/gu, '').replace(/[^a-z0-9]/g, '');

export function spriteKey(pokemon) {
  if (special[pokemon.id]) return special[pokemon.id];
  const regional = pokemon.name.match(/^(.+?) \(Forma de (Alola|Galar|Hisui)\)$/);
  if (regional) return `${normal(regional[1])}-${regional[2].toLowerCase()}`;
  const mega = pokemon.name.match(/^Mega-(.+?)(?: ([XYZ]))?$/);
  if (mega) return `${normal(mega[1])}-mega${mega[2]?.toLowerCase() || ''}`;
  return normal(pokemon.name.replace(/ \(.+\)$/, ''));
}
