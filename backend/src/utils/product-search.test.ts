import { describe, expect, test } from "bun:test";
import {
  extractNormalizedCodeHints,
  getNormalizedCodeMatchReason,
  normalizeCodeHint,
} from "./product-search";

describe("product search code normalization", () => {
  test("extracts slash-separated catalogue code hints from RFQ text", () => {
    expect(extractNormalizedCodeHints("Mitutoyo 0/25 Digimatic Mike 293/340")).toContain("293340");
  });

  test("matches slash-separated RFQ code hints against hyphenated catalog product codes", () => {
    const [hint] = extractNormalizedCodeHints("Mitutoyo 0/25 Digimatic Mike 293/340");

    expect(hint).toBe("293340");
    if (!hint) throw new Error("Expected a normalized code hint");
    expect(normalizeCodeHint("293-340-30")).toBe("29334030");
    expect(getNormalizedCodeMatchReason(hint, "293-340-30")).toBe("normalized_code_prefix");
    expect(getNormalizedCodeMatchReason(hint, "293-666-20")).toBeNull();
  });
});
