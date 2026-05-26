import { describe, expect, test } from "bun:test";
import {
  extractDimensionTokens,
  extractNormalizedCodeHints,
  extractProductFamilyAnchorTokens,
  getNormalizedCodeMatchReason,
  isCodeLikeSearchToken,
  normalizeProductSearchText,
  normalizeCodeHint,
  productMatchesAnchorTokens,
} from "./product-search";

describe("product search query normalization", () => {
  test("keeps micrometer ranges searchable when a dash separates the product and dimension", () => {
    const normalizedQuery = normalizeProductSearchText("Micrometer - 0-50 mm");

    expect(normalizedQuery).toBe("micrometer 0-50mm");
    expect(extractDimensionTokens(normalizedQuery)).toContain("0-50mm");
  });

  test("normalizes messy buyer wording while preserving range and catalogue code hints", () => {
    const normalizedQuery = normalizeProductSearchText(":itutoyo 0/25 Digimatic Mike 293/340");

    expect(normalizedQuery).toBe("itutoyo 0/25 digimatic mike 293/340");
    expect(extractDimensionTokens(normalizedQuery)).toEqual(expect.arrayContaining(["0-25mm", "0-25"]));
    expect(extractNormalizedCodeHints(normalizedQuery)).toContain("293340");
  });

  test("does not treat measurement tokens as product codes", () => {
    expect(isCodeLikeSearchToken("150mm")).toBe(false);
    expect(isCodeLikeSearchToken("300mm")).toBe(false);
    expect(isCodeLikeSearchToken("abc123")).toBe(true);
  });

  test("extracts dimension lists for vernier caliper requests", () => {
    const normalizedQuery = normalizeProductSearchText("Digital Vernier Caliper - 150 & 300mm");
    const dimensions = extractDimensionTokens(normalizedQuery);
    const anchors = extractProductFamilyAnchorTokens(normalizedQuery.split(" "));

    expect(dimensions).toEqual(expect.arrayContaining(["150mm", "300mm"]));
    expect(anchors).toEqual(expect.arrayContaining(["caliper", "vernier"]));
    expect(
      productMatchesAnchorTokens(
        { description: "Mitutoyo Digital Vernier Caliper 150mm", code: null },
        anchors
      )
    ).toBe(true);
    expect(
      productMatchesAnchorTokens(
        { description: "Kristeel Indian make Steel Scale 0-300 mm", code: null },
        anchors
      )
    ).toBe(false);
  });

  test("keeps micrometer ranges distinct from decimal thickness products", () => {
    const normalizedQuery = normalizeProductSearchText("Micrometer - 0-50 mm");
    const dimensions = extractDimensionTokens(normalizedQuery);
    const anchors = extractProductFamilyAnchorTokens(normalizedQuery.split(" "));

    expect(dimensions).toContain("0-50mm");
    expect(dimensions).not.toContain("0.50mm");
    expect(
      productMatchesAnchorTokens(
        { description: "INSIZE MAKE DEPTH MICROMETER 0-50 MM", code: null },
        anchors
      )
    ).toBe(true);
    expect(
      productMatchesAnchorTokens(
        { description: "Globe Feeler strips 0.50mm", code: null },
        anchors
      )
    ).toBe(false);
  });
});

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
