import { createGraph } from "./engine.mjs";
export class Database {
  constructor(base = new URL("../", import.meta.url), fetcher = fetch) {
    this.base = base;
    this.fetcher = (...args) => fetcher(...args);
    this.pending = new Map();
    this.data = {};
    this.revision = 0;
  }
  async init() {
    const response = await this.fetcher(new URL("manifest.json", this.base), {
      cache: "no-cache",
    });
    if (!response.ok) throw Error("No se pudo cargar el manifiesto.");
    this.manifest = await response.json();
    [this.catalog, this.coverage] = await Promise.all([
      this.read("data/catalog.json"),
      this.read("data/availability.json"),
    ]);
    await this.ensure(["types", "species", "pokemon", "abilities"]);
    return this;
  }
  async read(path) {
    if (!this.pending.has(path))
      this.pending.set(
        path,
        (async () => {
          const entry =
            this.manifest.files[path] ||
            (/^evidence\/[a-f0-9]{64}\.json$/.test(path)
              ? { sha256: path.slice(9, -5) }
              : null);
          if (!entry) throw Error(`Archivo no publicado: ${path}`);
          for (let attempt = 0; attempt < 2; attempt++) {
            const url = new URL(path, this.base);
            url.searchParams.set("v", entry.sha256);
            const response = await this.fetcher(url, {
              cache: attempt ? "reload" : "default",
            });
            if (!response.ok)
              throw Error(`No se pudo cargar ${path} (${response.status}).`);
            const bytes = await response.arrayBuffer();
            const hash = Array.from(
              new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
              (x) => x.toString(16).padStart(2, "0"),
            ).join("");
            if (hash === entry.sha256)
              return JSON.parse(new TextDecoder().decode(bytes));
          }
          throw Error(
            "Los archivos pertenecen a publicaciones diferentes. Recarga para obtener el conjunto actual.",
          );
        })().catch((e) => {
          this.pending.delete(path);
          throw e;
        }),
      );
    return this.pending.get(path);
  }
  async ensure(names) {
    let changed = false;
    await Promise.all(
      [...new Set(names)]
        .filter((c) => !this.data[c])
        .map(async (c) => {
          this.data[c] = await this.read(`data/${c}.json`);
          changed = true;
        }),
    );
    if (changed || !this.graph) {
      this.graph = createGraph(this.data, this.coverage);
      this.revision++;
    }
    return this.graph;
  }
  async relations() {
    return this.ensure([
      "moves",
      "learnsets",
      "interactions",
      "effects",
      "items",
      "natures",
      "battle-rules",
      "regulations",
    ]);
  }
  async evidence(c, id) {
    const index = await this.read(`data/evidence-${c}.json`);
    return Promise.all([
      this.read(index[id]),
      this.read("data/documents.json"),
    ]);
  }
}
