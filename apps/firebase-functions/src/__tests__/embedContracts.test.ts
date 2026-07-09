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

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fsPromises.readdir.mockImplementation(async (directory: string) => {
    if (directory.endsWith("/lib")) {
      return [
        dirent("transfers", "directory"),
        dirent("storage", "directory"),
        dirent("index.js", "file"),
      ];
    }
    if (directory.endsWith("/lib/transfers")) {
      return [dirent("utils.js", "file")];
    }
    if (directory.endsWith("/lib/storage")) {
      return [dirent("refs.js", "file")];
    }
    return [];
  });
  fsPromises.readFile.mockImplementation(async (filePath: string) => {
    if (filePath.endsWith("/lib/transfers/utils.js")) {
      return [
        'import { ContentType } from "@grids/contracts/types";',
        "import { extractGridStorageReferencesFromRecord } from '@grids/contracts/storage';",
      ].join("\n");
    }
    if (filePath.endsWith("/lib/storage/refs.js")) {
      return 'import { countReferencesByHash } from "@grids/contracts/storage";';
    }
    return "export const noop = true;";
  });
});

describe("embedContracts script", () => {
  it("embeds storage and types contracts and rewrites both import subpaths", async () => {
    await import(new URL("../../scripts/embedContracts.mjs", import.meta.url).href);

    expect(fsPromises.rm).toHaveBeenCalledWith(
      expect.stringMatching(/apps\/firebase-functions\/lib\/contracts$/),
      { recursive: true, force: true },
    );
    expect(fsPromises.mkdir).toHaveBeenCalledWith(
      expect.stringMatching(/apps\/firebase-functions\/lib\/contracts$/),
      { recursive: true },
    );
    expect(fsPromises.cp).toHaveBeenCalledWith(
      expect.stringMatching(/packages\/contracts\/dist\/storage$/),
      expect.stringMatching(/apps\/firebase-functions\/lib\/contracts\/storage$/),
      { recursive: true },
    );
    expect(fsPromises.cp).toHaveBeenCalledWith(
      expect.stringMatching(/packages\/contracts\/dist\/types$/),
      expect.stringMatching(/apps\/firebase-functions\/lib\/contracts\/types$/),
      { recursive: true },
    );

    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/apps\/firebase-functions\/lib\/transfers\/utils\.js$/),
      [
        'import { ContentType } from "../contracts/types/index.js";',
        "import { extractGridStorageReferencesFromRecord } from '../contracts/storage/index.js';",
      ].join("\n"),
    );
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/apps\/firebase-functions\/lib\/storage\/refs\.js$/),
      'import { countReferencesByHash } from "../contracts/storage/index.js";',
    );
    expect(fsPromises.writeFile).not.toHaveBeenCalledWith(
      expect.stringMatching(/apps\/firebase-functions\/lib\/index\.js$/),
      expect.anything(),
    );
  });
});
