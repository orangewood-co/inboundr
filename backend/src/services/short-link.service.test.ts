import { describe, expect, test } from "bun:test";
import {
  getBlockResult,
  hashPassword,
  isExpired,
  isViewLimitReached,
  normalizeDestinationUrl,
  normalizeShortCode,
  verifyPassword,
} from "./short-link.service";

describe("short-link service", () => {
  test("normalizes custom short codes", () => {
    expect(normalizeShortCode("  Spring Campaign! 2026 ")).toBe("spring-campaign-2026");
    expect(normalizeShortCode("A_B-c9")).toBe("a_b-c9");
  });

  test("accepts only http and https destinations", () => {
    expect(normalizeDestinationUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizeDestinationUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeDestinationUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeDestinationUrl("not a url")).toBeNull();
  });

  test("hashes and verifies passwords", () => {
    const password = hashPassword("secret");
    expect(verifyPassword("secret", password.salt, password.hash)).toBe(true);
    expect(verifyPassword("wrong", password.salt, password.hash)).toBe(false);
  });

  test("detects expired and view-limited links", () => {
    expect(isExpired({ expiresAt: new Date(Date.now() - 1000) })).toBe(true);
    expect(isExpired({ expiresAt: new Date(Date.now() + 1000) })).toBe(false);
    expect(isViewLimitReached({ maxViews: 3, viewCount: 3 })).toBe(true);
    expect(isViewLimitReached({ maxViews: 3, viewCount: 2 })).toBe(false);
    expect(isViewLimitReached({ maxViews: null, viewCount: 999 })).toBe(false);
  });

  test("returns the first blocking redirect result", () => {
    expect(getBlockResult({ status: "disabled", expiresAt: null, maxViews: null, viewCount: 0 })).toBe("disabled");
    expect(getBlockResult({ status: "active", expiresAt: new Date(Date.now() - 1000), maxViews: null, viewCount: 0 })).toBe("expired");
    expect(getBlockResult({ status: "active", expiresAt: null, maxViews: 1, viewCount: 1 })).toBe("view_limit_reached");
    expect(getBlockResult({ status: "active", expiresAt: null, maxViews: 1, viewCount: 0 })).toBeNull();
  });
});
