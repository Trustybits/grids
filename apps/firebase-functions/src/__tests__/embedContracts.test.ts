import { beforeEach, describe, expect, it, vi } from "vitest";

const fsPromises = vi.hoisted(() => ({
  cp: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => fsPromises);

function dirent(name: string, type: "file" | "directory") {
  return {
    name,
    isDirectory: () => type === "directory",
    isFile: () => type === "file",
  };
}

// The script builds paths with node's `path` module, so separators are
// platform-specific (`\` on Windows, `/` on POSIX). Normalize to forward
// slashes so the mock predicates below match regardless of platform.
function toPosix(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fsPromises.readdir.mockImplementation(async (directory: string) => {
    const dir = toPosix(directory);
    if (dir.endsWith("/lib")) {
      return [
        dirent("transfers", "directory"),
        dirent("storage", "directory"),
        dirent("index.js", "file"),
      ];
    }
    if (dir.endsWith("/lib/transfers")) {
      return [dirent("utils.js", "file")];
    }
    if (dir.endsWith("/lib/storage")) {
      return [dirent("refs.js", "file")];
    }
    return [];
  });
  fsPromises.readFile.mockImplementation(async (filePath: string) => {
    const file = toPosix(filePath);
    if (file.endsWith("/lib/transfers/utils.js")) {
      return [
        'import { ContentType } from "@grids/contracts/types";',
        "import { extractGridStorageReferencesFromRecord } from '@grids/contracts/storage';",
      ].join("\n");
    }
    if (file.endsWith("/lib/storage/refs.js")) {
      return 'import { countReferencesByHash } from "@grids/contracts/storage";';
    }
    return "export const noop = true;";
  });
});

describe("embedContracts script", () => {
  it("embeds storage and types contracts and rewrites both import subpaths", async () => {
    await import(new URL("../../scripts/embedContracts.mjs", import.meta.url).href);

    expect(fsPromises.rm).toHaveBeenCalledWith(
      expect.stringMatching(/apps[\\/]firebase-functions[\\/]lib[\\/]contracts$/),
      { recursive: true, force: true },
    );
    expect(fsPromises.mkdir).toHaveBeenCalledWith(
      expect.stringMatching(/apps[\\/]firebase-functions[\\/]lib[\\/]contracts$/),
      { recursive: true },
    );
    expect(fsPromises.cp).toHaveBeenCalledWith(
      expect.stringMatching(/packages[\\/]contracts[\\/]dist[\\/]storage$/),
      expect.stringMatching(
        /apps[\\/]firebase-functions[\\/]lib[\\/]contracts[\\/]storage$/,
      ),
      { recursive: true },
    );
    expect(fsPromises.cp).toHaveBeenCalledWith(
      expect.stringMatching(/packages[\\/]contracts[\\/]dist[\\/]types$/),
      expect.stringMatching(
        /apps[\\/]firebase-functions[\\/]lib[\\/]contracts[\\/]types$/,
      ),
      { recursive: true },
    );

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(
        /apps[\\/]firebase-functions[\\/]lib[\\/]transfers[\\/]utils\.js$/,
      ),
      [
        'import { ContentType } from "../contracts/types/index.js";',
        "import { extractGridStorageReferencesFromRecord } from '../contracts/storage/index.js';",
      ].join("\n"),
    );
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(
        /apps[\\/]firebase-functions[\\/]lib[\\/]storage[\\/]refs\.js$/,
      ),
      'import { countReferencesByHash } from "../contracts/storage/index.js";',
    );
    expect(fsPromises.writeFile).not.toHaveBeenCalledWith(
      expect.stringMatching(/apps[\\/]firebase-functions[\\/]lib[\\/]index\.js$/),
      expect.anything(),
    );
  });
});
