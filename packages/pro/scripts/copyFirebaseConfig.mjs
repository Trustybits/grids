import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Copy the (gitignored) firebaseConfigs.json into dist/runtime so the
// import.meta.glob in firebaseConfigs.ts resolves at runtime. Optional by
// design: when the file is absent (public/OSS checkout) this is a no-op and
// @grids/pro falls back to the stubbed backend.

const src = fileURLToPath(
  new URL("../src/runtime/firebaseConfigs.json", import.meta.url),
);
const dest = fileURLToPath(
  new URL("../dist/runtime/firebaseConfigs.json", import.meta.url),
);

if (existsSync(src)) {
  mkdirSync(fileURLToPath(new URL("../dist/runtime", import.meta.url)), {
    recursive: true,
  });
  copyFileSync(src, dest);
}
