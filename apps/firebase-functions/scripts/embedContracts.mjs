import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(functionsDir, "../..");
const contractsDist = path.join(repoRoot, "packages/contracts/dist");
const functionsLib = path.join(functionsDir, "lib");
const embeddedContractsDir = path.join(functionsLib, "contracts");
const embeddedContractSubpaths = [
  {
    specifier: "@grids/contracts/storage",
    distDir: path.join(contractsDist, "storage"),
    embeddedDir: path.join(embeddedContractsDir, "storage"),
    index: path.join(embeddedContractsDir, "storage/index.js"),
  },
  {
    specifier: "@grids/contracts/types",
    distDir: path.join(contractsDist, "types"),
    embeddedDir: path.join(embeddedContractsDir, "types"),
    index: path.join(embeddedContractsDir, "types/index.js"),
  },
];

await rm(embeddedContractsDir, { recursive: true, force: true });
await mkdir(embeddedContractsDir, { recursive: true });

for (const subpath of embeddedContractSubpaths) {
  await cp(subpath.distDir, subpath.embeddedDir, { recursive: true });
}

await rewriteContractImports(functionsLib);

async function rewriteContractImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await rewriteContractImports(entryPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

    const source = await readFile(entryPath, "utf8");
    if (
      !embeddedContractSubpaths.some((subpath) =>
        source.includes(subpath.specifier),
      )
    ) {
      continue;
    }

    let rewritten = source;
    for (const subpath of embeddedContractSubpaths) {
      const relativeImport = normalizeImportPath(
        path.relative(path.dirname(entryPath), subpath.index),
      );
      rewritten = rewritten
        .replaceAll(`"${subpath.specifier}"`, `"${relativeImport}"`)
        .replaceAll(`'${subpath.specifier}'`, `'${relativeImport}'`);
    }

    if (rewritten !== source) {
      await writeFile(entryPath, rewritten);
    }
  }
}

function normalizeImportPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}
