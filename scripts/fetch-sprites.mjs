import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { spriteKey, pokeApiSpriteIds } from './lib/sprite-map.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pokemon = JSON.parse(await readFile(join(root, 'data/pokemon.json')));
const source = 'https://play.pokemonshowdown.com/sprites/gen5/';
const page = await fetch(source);
if (!page.ok) throw Error(`Sprite index: HTTP ${page.status}`);
const $ = load(await page.text());
const indexed = new Set($('a[href$=".png"]').toArray()
  .map((a) => decodeURIComponent($(a).attr('href').split('/').pop())));
const rows = pokemon.map((row) => {
  const file = `${spriteKey(row)}.png`;
  return {
    id: row.id, name: row.name, file,
    source: pokeApiSpriteIds[row.id]
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeApiSpriteIds[row.id]}.png`
      : source + file,
  };
});
const missing = rows.filter((row) => !pokeApiSpriteIds[row.id] && !indexed.has(row.file));
if (missing.length) {
  for (const row of missing) {
    console.error(`${row.id} ${row.name} → ${row.file}`);
    console.error([...indexed].filter((file) => file.startsWith(row.file.split('-')[0].slice(0, 6))).slice(0, 12).join(', '));
  }
  throw Error(`${missing.length} Pokémon sin sprite de su forma`);
}
console.log(`${rows.length} sprites de forma localizados (${rows.length - Object.keys(pokeApiSpriteIds).length} Showdown, ${Object.keys(pokeApiSpriteIds).length} PokéAPI).`);
if (!process.argv.includes('--download')) process.exit(0);

const directory = join(root, 'site/sprites');
await mkdir(directory, { recursive: true });
const manifest = {};
for (let offset = 0; offset < rows.length; offset += 8) {
  await Promise.all(rows.slice(offset, offset + 8).map(async (row) => {
    const url = row.source;
    const response = await fetch(url);
    if (!response.ok) throw Error(`${row.id}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      throw Error(`${row.id}: no es PNG`);
    await writeFile(join(directory, `${row.id}.png`), bytes);
    manifest[row.id] = { source: url, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
}
await writeFile(join(directory, 'manifest.json'), JSON.stringify(Object.fromEntries(
  Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
), null, 2) + '\n');
console.log(`Guardados ${rows.length} sprites locales.`);
