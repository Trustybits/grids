/**
 * Unit tests for FirebaseCloudFunctionsDao
 *
 * Covers:
 *  - callFunction: creates a callable for the given name, forwards the request
 *    payload, unwraps result.data, and propagates callable errors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { FirebaseCloudFunctionsDao } from "../FirebaseCloudFunctionsDao.js";
import type { Functions } from "firebase/functions";

const fakeFunctions = {} as Functions;

describe("FirebaseCloudFunctionsDao", () => {
  let dao: FirebaseCloudFunctionsDao;

  beforeEach(() => {
    dao = new FirebaseCloudFunctionsDao(fakeFunctions);
  });

  describe("callFunction", () => {
    it("creates a callable for the function name and returns the unwrapped data", async () => {
      const callable = vi.fn().mockResolvedValue({ data: { ok: true } });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.callFunction("myFunction", { foo: "bar" });

      expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, "myFunction");
      expect(callable).toHaveBeenCalledWith({ foo: "bar" });
      expect(result).toEqual({ ok: true });
    });

    it("forwards null/undefined request payloads as-is", async () => {
      const callable = vi.fn().mockResolvedValue({ data: null });
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      const result = await dao.callFunction("noArgs", undefined);

      expect(callable).toHaveBeenCalledWith(undefined);
      expect(result).toBeNull();
    });

    it("propagates errors thrown by the callable", async () => {
      const callable = vi.fn().mockRejectedValue(new Error("internal"));
      vi.mocked(httpsCallable).mockReturnValue(callable as any);

      await expect(dao.callFunction("explodes", {})).rejects.toThrow("internal");
    });
  });
});
