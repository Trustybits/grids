// Unit tests for CloudFunctionsService — CloudFunctionsDao is mocked via the
// DAO factory singleton. This service is a thin pass-through; tests verify it
// forwards arguments and results unchanged.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudFunctionsService } from "@/services/CloudFunctionsService";
import type { CloudFunctionsDao } from "@grids/contracts/dao";
import { registerTestDaoFactory } from "./testHelpers";

let mockCloudFunctionsDao: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  mockCloudFunctionsDao = {
    callFunction: vi.fn(),
  };

  registerTestDaoFactory({
    getCloudFunctionsDao: () =>
      mockCloudFunctionsDao as unknown as CloudFunctionsDao,
  });
});

describe("constructor", () => {
  it("resolves the CloudFunctionsDao from the factory", () => {
    const getCloudFunctionsDao = vi.fn(
      () => mockCloudFunctionsDao as unknown as CloudFunctionsDao,
    );
    registerTestDaoFactory({
      getCloudFunctionsDao,
    });

    new CloudFunctionsService();

    expect(getCloudFunctionsDao).toHaveBeenCalledTimes(1);
  });
});

describe("callFunction", () => {
  it("forwards the function name and data, returning the DAO result", async () => {
    const response = { ok: true };
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce(response);

    const service = new CloudFunctionsService();
    const result = await service.callFunction("doThing", { a: 1 });

    expect(mockCloudFunctionsDao.callFunction).toHaveBeenCalledWith("doThing", {
      a: 1,
    });
    expect(result).toBe(response);
  });

  it("passes undefined data through unchanged", async () => {
    mockCloudFunctionsDao.callFunction.mockResolvedValueOnce(null);

    const service = new CloudFunctionsService();
    await service.callFunction("noArgs", undefined);

    expect(mockCloudFunctionsDao.callFunction).toHaveBeenCalledWith(
      "noArgs",
      undefined,
    );
  });

  it("propagates errors from the DAO", async () => {
    mockCloudFunctionsDao.callFunction.mockRejectedValueOnce(
      new Error("function error"),
    );

    const service = new CloudFunctionsService();
    await expect(service.callFunction("boom", {})).rejects.toThrow(
      "function error",
    );
  });
});
