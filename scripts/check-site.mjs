import { readdir, readFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
const root = resolve("dist");
async function fingerprint() {
  const paths = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else paths.push(file);
    }
  }
  await walk(root);
  const hash = createHash("sha256");
  for (const path of paths.sort()) {
    hash.update(relative(root, path).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(path));
    hash.update("\0");
  }
  return { hash: hash.digest("hex"), count: paths.length };
}
const before = await fingerprint();
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/build-site.mjs"], {
    stdio: "inherit",
  });
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(Error(`La construcción falló (${code}).`)),
  );
});
const after = await fingerprint();
if (before.hash !== after.hash)
  throw Error("La reconstrucción ha cambiado el contenido de la web.");
console.log(
  `Reconstrucción idéntica: ${after.count} archivos, SHA-256 ${after.hash}.`,
);
