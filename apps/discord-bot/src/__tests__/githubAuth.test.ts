import { describe, expect, it } from "vitest";
import { normalizePrivateKey } from "../githubAuth.js";

describe("normalizePrivateKey", () => {
  it("converts escaped newlines to real newlines", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\\nline\\n-----END RSA PRIVATE KEY-----";
    expect(normalizePrivateKey(key)).toBe(
      "-----BEGIN RSA PRIVATE KEY-----\nline\n-----END RSA PRIVATE KEY-----",
    );
  });

  it("leaves already-normalized PEM unchanged", () => {
    const key = "-----BEGIN RSA PRIVATE KEY-----\nline\n-----END RSA PRIVATE KEY-----";
    expect(normalizePrivateKey(key)).toBe(key);
  });
});
