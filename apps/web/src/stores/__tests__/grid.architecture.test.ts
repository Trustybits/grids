import { describe, expect, it } from "vitest";
import gridFacadeSource from "../grid.ts?raw";

const focusedStoreSources = import.meta.glob("../grid/*.ts", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const consumerSources = {
  ...import.meta.glob("../../components/**/*.{ts,vue}", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  ...import.meta.glob("../../composables/**/*.{ts,vue}", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
} as Record<string, string>;

function importedModules(source: string): string[] {
  return Array.from(
    source.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    (match) => match[1]!,
  );
}

describe("grid store architecture", () => {
  it("keeps focused grid stores independent from each other and the controller", () => {
    for (const [path, source] of Object.entries(focusedStoreSources)) {
      const imports = importedModules(source);

      expect(
        imports.filter((specifier) =>
          specifier.startsWith("@/stores/grid/"),
        ),
        `${path} imports another focused grid module`,
      ).toEqual([]);
      expect(
        imports.filter((specifier) =>
          specifier.startsWith("@/controllers/"),
        ),
        `${path} imports a controller`,
      ).toEqual([]);
    }
  });

  it("keeps components and composables on the compatibility facade", () => {
    for (const [path, source] of Object.entries(consumerSources)) {
      if (path.includes("/__tests__/")) continue;
      const imports = importedModules(source);

      expect(
        imports.filter((specifier) =>
          specifier.startsWith("@/stores/grid/"),
        ),
        `${path} bypasses the grid compatibility facade`,
      ).toEqual([]);
      expect(
        imports.filter((specifier) =>
          /^@\/controllers\/(?:GridController|useGridController)$/.test(
            specifier,
          ),
        ),
        `${path} imports GridController directly`,
      ).toEqual([]);
    }
  });

  it("limits grid.ts to facade dependencies and a setup-store definition", () => {
    const allowedImports = new Set([
      "vue",
      "pinia",
      "@grids/contracts/types",
      "@/controllers/useGridController",
      "@/stores/grid/gridUi",
      "@/stores/grid/gridViewport",
      "@/stores/grid/gridCollection",
      "@/stores/grid/gridCompatibility",
      "@/stores/grid/gridSession",
      "@/stores/grid/gridHistory",
      "@/stores/grid/gridUploads",
      "@/stores/grid/gridFacadePolicy",
    ]);

    expect(
      importedModules(gridFacadeSource).filter(
        (specifier) => !allowedImports.has(specifier),
      ),
    ).toEqual([]);
    expect(gridFacadeSource).toContain(
      'defineStore("grid", () => {',
    );
    expect(gridFacadeSource).not.toMatch(
      /\b(?:let|const)\s+(?:undoRedoManager|pendingDragSnapshot|pendingResizeSnapshot|lastStableSnapshot|pendingEditSnapshot|editingTileId)\b/,
    );
  });
});
