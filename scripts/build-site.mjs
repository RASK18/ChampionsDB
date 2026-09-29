import { readFile, writeFile, mkdir, cp, rename, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { collections, buildCatalog, words } from "../site/catalog.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const stage = join(root, ".site-stage"),
  out = join(root, "dist"),
  previous = join(root, ".site-previous");
for (const target of [stage, out, previous])
  if (!resolve(target).startsWith(root + sep))
    throw Error("Directorio de publicación fuera del repositorio.");
const json = async (path) => {
  const bytes = await readFile(join(root, path));
  if (path.startsWith("data/") && path !== "data/manifest.json") {
    const expected = manifest.files[path.slice(5)];
    if (!expected || sha(bytes) !== expected.sha256)
      throw Error(`Huella incorrecta: ${path}`);
  }
  return JSON.parse(bytes);
};
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = await json("data/manifest.json");
const data = {},
  schemas = {};
for (const c of collections) {
  const bytes = await readFile(join(root, `data/${c}.json`));
  if (sha(bytes) !== manifest.files[`${c}.json`].sha256)
    throw Error(`Huella incorrecta: ${c}`);
  data[c] = JSON.parse(bytes);
  schemas[c] = await json(`schemas/${c}.schema.json`);
}
const catalog = buildCatalog(data, schemas);
const unlabelled = [
  ...new Set(
    Object.values(catalog).flatMap((fields) =>
      fields.flatMap((f) =>
        f.path.split(".").filter((k) => k !== "*" && !words[k]),
      ),
    ),
  ),
];
if (unlabelled.length)
  throw Error(`Campos sin etiqueta española: ${unlabelled.join(", ")}`);
const spriteManifest = await json('site/sprites/manifest.json');
const pokemonIds = new Set(data.pokemon.map((row) => row.id));
if (Object.keys(spriteManifest).length !== pokemonIds.size)
  throw Error('El catálogo de sprites no cubre todas las formas publicadas');
for (const [id, sprite] of Object.entries(spriteManifest)) {
  if (!pokemonIds.has(id) || !/^https:\/\/(play\.pokemonshowdown\.com|raw\.githubusercontent\.com)\//.test(sprite.source))
    throw Error(`Sprite no trazable: ${id}`);
  const bytes = await readFile(join(root, `site/sprites/${id}.png`));
  if (sha(bytes) !== sprite.sha256) throw Error(`Huella incorrecta del sprite: ${id}`);
}
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await mkdir(join(stage, "site"), { recursive: true });
await mkdir(join(stage, "lib"), { recursive: true });
await cp(join(root, "site"), join(stage, "site"), { recursive: true });
await cp(join(root, "lib/queries.mjs"), join(stage, "lib/queries.mjs"));
await cp(join(root, "site/index.html"), join(stage, "index.html"));
await writeFile(join(stage, ".nojekyll"), "");
const files = {};
async function emit(path, value, { indexed = true } = {}) {
  const bytes = Buffer.from(JSON.stringify(value) + "\n");
  await mkdir(join(stage, path, ".."), { recursive: true });
  await writeFile(join(stage, path), bytes);
  if (indexed) files[path] = { sha256: sha(bytes), bytes: bytes.length };
}
const coverage = await json("data/reports/coverage.json");
const pending = await json("data/reports/pending.json");
const excluded = await json("data/reports/excluded.json");
const snapshot = await json("data/snapshot.json");
const learnsetCompleteness = await json("data/reports/learnset-completeness.json");
if (learnsetCompleteness.revision !== snapshot.revisions.champout ||
  learnsetCompleteness.sha256 !== snapshot.documents[learnsetCompleteness.source]?.sha256)
  throw new Error('La certificación de aprendizajes no corresponde a la captura publicada');
const availability = {
  complete: coverage.complete,
  collections: coverage.collections,
  pendingCount: coverage.pendingCount,
  fields: {},
  relations: learnsetCompleteness.relations,
  excluded: excluded.map((x) => x.entity),
};
for (const p of pending) {
  if (p.claim) availability.fields[p.claim] = p.reason;
}
// Other relationships remain open until their source inventory is certified.
await emit("data/availability.json", availability);
await emit("data/catalog.json", catalog);
for (const c of collections) {
  await emit(`data/${c}.json`, data[c]);
  const provenance = await json(`data/provenance/${c}.json`);
  const perEntity = new Map(
    data[c].map((r) => [r.id, { facts: {}, observations: {}, pending: [] }]),
  );
  for (const [claim, fact] of Object.entries(provenance.facts)) {
    const [, id, field] = claim.split("/");
    const record = perEntity.get(id);
    if (!record) continue;
    record.facts[field] = fact;
    for (const witness of fact.witnesses)
      record.observations[witness] = provenance.observations[witness];
  }
  for (const p of pending) {
    const [pc, id] = p.claim?.split("/") || [];
    if (pc === c && perEntity.has(id)) perEntity.get(id).pending.push(p);
  }
  // Content-addressed entity fragments prevent mixed evidence during a CDN update.
  const evidenceIndex = {};
  for (const [id, record] of perEntity) {
    const hash = sha(JSON.stringify(record) + "\n");
    const path = `evidence/${hash}.json`;
    await emit(path, record, { indexed: false });
    evidenceIndex[id] = path;
  }
  await emit(`data/evidence-${c}.json`, evidenceIndex);
}
await emit("data/documents.json", snapshot.documents);
await emit("data/coverage.json", coverage);
const siteManifest = {
  datasetId: manifest.datasetId,
  context: manifest.context,
  sourcePolicy: manifest.sourcePolicy,
  complete: manifest.complete,
  files,
};
await writeFile(
  join(stage, "manifest.json"),
  JSON.stringify(siteManifest) + "\n",
);
// These fixed build directories are inside this repository; never remove source data.
await rm(previous, { recursive: true, force: true });
try {
  await rename(out, previous);
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
try {
  await rename(stage, out);
} catch (e) {
  await rename(previous, out).catch(() => {});
  throw e;
}
await rm(previous, { recursive: true, force: true });
console.log(
  `Web generada: ${collections.length} tablas, ${Object.values(catalog).flat().length} campos, ${manifest.datasetId.slice(0, 12)}.`,
);
