import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(functionsDir, "../..");
const contractsDist = path.join(repoRoot, "packages/contracts/dist");
const functionsLib = path.join(functionsDir, "lib");
const embeddedContractsDir = path.join(functionsLib, "contracts");
const embeddedStorageIndex = path.join(
  embeddedContractsDir,
  "storage/index.js",
);

await rm(embeddedContractsDir, { recursive: true, force: true });
await mkdir(path.join(embeddedContractsDir, "types"), { recursive: true });

await cp(
  path.join(contractsDist, "storage"),
  path.join(embeddedContractsDir, "storage"),
  { recursive: true },
);
await cp(
  path.join(contractsDist, "types/TileContent.js"),
  path.join(embeddedContractsDir, "types/TileContent.js"),
);
await cp(
  path.join(contractsDist, "types/TileContent.js.map"),
  path.join(embeddedContractsDir, "types/TileContent.js.map"),
);

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
    if (!source.includes("@grids/contracts/storage")) continue;

    const relativeImport = normalizeImportPath(
      path.relative(path.dirname(entryPath), embeddedStorageIndex),
    );
    const rewritten = source
      .replaceAll('"@grids/contracts/storage"', `"${relativeImport}"`)
      .replaceAll("'@grids/contracts/storage'", `'${relativeImport}'`);

    if (rewritten !== source) {
      await writeFile(entryPath, rewritten);
    }
  }
}

function normalizeImportPath(relativePath) {
  const normalized = relativePath.split(path.sep).join("/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}
