import { Pool } from "pg";
import type { DatabaseConfig } from "../types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "inch",
  "inches",
  "length",
  "need",
  "of",
  "please",
  "quotation",
  "quote",
  "required",
  "share",
  "the",
  "to",
  "we",
  "with",
]);

const TOKEN_ALIASES = new Map<string, string[]>([
  ["analog", ["analogue"]],
  ["analogue", ["analog"]],
  ["digimatic", ["digital"]],
  ["digital", ["digimatic"]],
  ["mic", ["micrometer"]],
  ["mics", ["micrometer"]],
  ["mike", ["micrometer"]],
  ["micrometer", ["mike"]],
]);

const PRODUCT_FAMILY_ANCHOR_ALIASES = new Map<string, string[]>([
  ["caliper", ["caliper", "calipers", "calliper", "callipers", "vernier"]],
  ["calipers", ["caliper", "calipers", "calliper", "callipers", "vernier"]],
  ["calliper", ["caliper", "calipers", "calliper", "callipers", "vernier"]],
  ["callipers", ["caliper", "calipers", "calliper", "callipers", "vernier"]],
  ["vernier", ["caliper", "calipers", "calliper", "callipers", "vernier"]],
  ["mic", ["micrometer", "micrometers"]],
  ["mics", ["micrometer", "micrometers"]],
  ["mike", ["micrometer", "micrometers"]],
  ["micrometer", ["micrometer", "micrometers"]],
  ["micrometers", ["micrometer", "micrometers"]],
]);

const NON_BRAND_TOKENS = new Set([
  "analog",
  "analogue",
  "depth",
  "digital",
  "digimatic",
  "inside",
  "outside",
  ...PRODUCT_FAMILY_ANCHOR_ALIASES.keys(),
  ...[...PRODUCT_FAMILY_ANCHOR_ALIASES.values()].flat(),
]);

export type ProductMatchStatus = "matched" | "ambiguous" | "no_match";

export interface ProductSearchMatch {
  id: number;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  calibrationCharges: number | null;
  link: string | null;
  isTopSeller: boolean;
  score: number;
  matchReasons: string[];
}

export interface ProductSearchGroup {
  query: {
    name: string;
    quantity: number;
  };
  normalizedQuery: string;
  searchTokens: string[];
  matchedBrand: string | null;
  status: ProductMatchStatus;
  matches: ProductSearchMatch[];
}

interface RankedProductRow {
  id: number;
  brand: string | null;
  productdescription: string | null;
  productcode: string | null;
  unitprice: string | number | null;
  hsncode: string | null;
  gstrate: string | number | null;
  calibrationcharges: string | number | null;
  productlink: string | null;
  is_top_seller: boolean | null;
  rank_score: string | number;
  match_reasons: string[] | null;
}

interface SearchQueryParts {
  normalizedQuery: string;
  searchTokens: string[];
  textTokens: string[];
  brandTokens: string[];
  dimensionTokens: string[];
  codeLikeTokens: string[];
  normalizedCodeHints: string[];
  requiredAnchorTokens: string[];
  exactCodeQuery: string;
  phrasePattern: string;
}

const TEXT_SEARCH_SQL = `
  WITH candidate_products AS (
    SELECT
      p.id,
      p.brand,
      p.productdescription,
      p.productcode,
      p.unitprice,
      p.hsncode,
      p.gstrate,
      p.calibrationcharges,
      p.productlink,
      COALESCE(p.is_top_seller, false) AS is_top_seller,
      CASE
        WHEN $1 <> '' AND lower(COALESCE(p.productcode, '')) = $1 THEN 220
        ELSE 0
      END AS exact_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($8::text[]) AS code_hint
          WHERE regexp_replace(lower(COALESCE(p.productcode, '')), '[^a-z0-9]', '', 'g') = code_hint
        ) THEN 320
        ELSE 0
      END AS normalized_exact_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($8::text[]) AS code_hint
          WHERE regexp_replace(lower(COALESCE(p.productcode, '')), '[^a-z0-9]', '', 'g') LIKE code_hint || '%'
        ) THEN 260
        ELSE 0
      END AS normalized_prefix_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($8::text[]) AS code_hint
          WHERE regexp_replace(lower(COALESCE(p.productcode, '') || ' ' || COALESCE(p.productdescription, '')), '[^a-z0-9]', '', 'g') LIKE '%' || code_hint || '%'
        ) THEN 180
        ELSE 0
      END AS normalized_contains_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($2::text[]) AS pattern
        WHERE lower(COALESCE(p.productcode, '')) LIKE pattern
           OR lower(COALESCE(p.productdescription, '')) LIKE pattern
        ) THEN 110
        ELSE 0
      END AS partial_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($3::text[]) AS brand_token
          WHERE lower(COALESCE(p.brand, '')) = brand_token
             OR lower(COALESCE(p.brand, '')) LIKE '%' || brand_token || '%'
        ) THEN 80
        ELSE 0
      END AS brand_score,
      CASE
        WHEN $4 <> '' AND lower(COALESCE(p.productdescription, '')) LIKE $5 THEN 60
        ELSE 0
      END AS phrase_score,
      COALESCE((
        SELECT COUNT(*) * 18
        FROM unnest($6::text[]) AS token
        WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || token || '%'
           OR lower(COALESCE(p.brand, '')) LIKE '%' || token || '%'
           OR lower(COALESCE(p.productcode, '')) LIKE '%' || token || '%'
      ), 0) AS token_score,
      COALESCE((
        SELECT COUNT(*) * 28
        FROM unnest($7::text[]) AS dimension_token
        WHERE regexp_replace(lower(COALESCE(p.productdescription, '')), '[[:space:]]+', '', 'g') LIKE '%' || regexp_replace(dimension_token, '[[:space:]]+', '', 'g') || '%'
           OR regexp_replace(lower(COALESCE(p.productcode, '')), '[[:space:]]+', '', 'g') LIKE '%' || regexp_replace(dimension_token, '[[:space:]]+', '', 'g') || '%'
      ), 0) AS dimension_score,
      CASE
        WHEN COALESCE(p.is_top_seller, false) THEN 30
        ELSE 0
      END AS top_seller_score
    FROM products p
    WHERE
      p.organization_id = $11
      AND
      (
        cardinality($13::text[]) = 0
        OR EXISTS (
          SELECT 1
          FROM unnest($13::text[]) AS anchor_token
          WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || anchor_token || '%'
             OR lower(COALESCE(p.productcode, '')) LIKE '%' || anchor_token || '%'
        )
      )
      AND
      (
        ($4 <> '' AND lower(COALESCE(p.productdescription, '')) LIKE $5)
        OR EXISTS (
          SELECT 1
          FROM unnest($12::text[]) AS text_token
          WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || text_token || '%'
             OR lower(COALESCE(p.brand, '')) LIKE '%' || text_token || '%'
             OR lower(COALESCE(p.productcode, '')) LIKE '%' || text_token || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($7::text[]) AS dimension_token
          WHERE cardinality($12::text[]) = 0
            AND (
              regexp_replace(lower(COALESCE(p.productdescription, '')), '[[:space:]]+', '', 'g') LIKE '%' || regexp_replace(dimension_token, '[[:space:]]+', '', 'g') || '%'
              OR regexp_replace(lower(COALESCE(p.productcode, '')), '[[:space:]]+', '', 'g') LIKE '%' || regexp_replace(dimension_token, '[[:space:]]+', '', 'g') || '%'
            )
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($2::text[]) AS pattern
          WHERE lower(COALESCE(p.productcode, '')) LIKE pattern
             OR lower(COALESCE(p.productdescription, '')) LIKE pattern
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($8::text[]) AS code_hint
          WHERE regexp_replace(lower(COALESCE(p.productcode, '') || ' ' || COALESCE(p.productdescription, '')), '[^a-z0-9]', '', 'g') LIKE '%' || code_hint || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($3::text[]) AS brand_token
          WHERE lower(COALESCE(p.brand, '')) = brand_token
             OR lower(COALESCE(p.brand, '')) LIKE '%' || brand_token || '%'
        )
      )
  ),
  scored_products AS (
    SELECT
      *,
      exact_code_score
        + normalized_exact_code_score
        + normalized_prefix_code_score
        + normalized_contains_code_score
        + partial_code_score
        + brand_score
        + phrase_score
        + token_score
        + dimension_score AS base_score,
      exact_code_score
        + normalized_exact_code_score
        + normalized_prefix_code_score
        + normalized_contains_code_score
        + partial_code_score
        + brand_score
        + phrase_score
        + token_score
        + dimension_score
        + top_seller_score AS rank_score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN exact_code_score > 0 THEN 'exact_code' END,
        CASE WHEN normalized_exact_code_score > 0 THEN 'normalized_exact_code' END,
        CASE WHEN normalized_prefix_code_score > 0 THEN 'normalized_code_prefix' END,
        CASE WHEN normalized_contains_code_score > 0 THEN 'normalized_code_contains' END,
        CASE WHEN partial_code_score > 0 THEN 'partial_code' END,
        CASE WHEN brand_score > 0 THEN 'brand' END,
        CASE WHEN phrase_score > 0 THEN 'full_phrase' END,
        CASE WHEN token_score > 0 THEN 'token_overlap' END,
        CASE WHEN dimension_score > 0 THEN 'dimension' END,
        CASE WHEN top_seller_score > 0 THEN 'top_seller' END
      ], NULL) AS match_reasons
    FROM candidate_products
  )
  SELECT
    id,
    brand,
    productdescription,
    productcode,
    unitprice,
    hsncode,
    gstrate,
    calibrationcharges,
    productlink,
    is_top_seller,
    rank_score,
    match_reasons
  FROM scored_products
  WHERE base_score >= $9
  ORDER BY rank_score DESC, char_length(COALESCE(productdescription, '')) ASC, id ASC
  LIMIT $10
`;

export class TextProductSearcher {
  private pool: Pool;

  constructor(dbConfig: DatabaseConfig) {
    this.pool = new Pool(dbConfig);
  }

  async searchProduct(
    query: { name: string; quantity: number },
    organizationId: string,
    limit: number = 5
  ): Promise<ProductSearchGroup> {
    const parts = this.buildSearchQuery(query.name);

    if (!parts.normalizedQuery || parts.searchTokens.length === 0) {
      return {
        query,
        normalizedQuery: parts.normalizedQuery,
        searchTokens: parts.searchTokens,
        matchedBrand: null,
        status: "no_match",
        matches: [],
      };
    }

    const client = await this.pool.connect();

    try {
      const result = await client.query<RankedProductRow>(TEXT_SEARCH_SQL, [
        parts.exactCodeQuery,
        parts.codeLikeTokens.map((token) => `%${token}%`),
        parts.brandTokens,
        parts.normalizedQuery,
        parts.phrasePattern,
        parts.searchTokens,
        parts.dimensionTokens,
        parts.normalizedCodeHints,
        this.getMinimumScore(parts),
        limit,
        organizationId,
        parts.textTokens,
        parts.requiredAnchorTokens,
      ]);

      const matches = result.rows.map((row) => ({
        id: row.id,
        brand: row.brand,
        description: row.productdescription,
        code: row.productcode,
        price: toNumberOrNull(row.unitprice),
        hsnCode: row.hsncode,
        gstRate: toNumberOrNull(row.gstrate),
        calibrationCharges: toNumberOrNull(row.calibrationcharges),
        link: row.productlink,
        isTopSeller: Boolean(row.is_top_seller),
        score: Number(row.rank_score),
        matchReasons: row.match_reasons ?? [],
      }));

      return {
        query,
        normalizedQuery: parts.normalizedQuery,
        searchTokens: parts.searchTokens,
        matchedBrand: matches[0]?.brand ?? null,
        status: this.resolveStatus(matches),
        matches,
      };
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private buildSearchQuery(query: string): SearchQueryParts {
    const normalizedQuery = normalizeText(query);
    const rawTokens = normalizedQuery.split(" ").filter(Boolean);
    const dimensionTokens = extractDimensionTokens(normalizedQuery);
    const baseSearchTokens = unique(
      rawTokens.filter((token) => {
        if (STOP_WORDS.has(token)) {
          return false;
        }

        if (dimensionTokens.includes(token)) {
          return true;
        }

        return /[a-z]/.test(token) || /\d/.test(token);
      })
    );
    const searchTokens = unique([
      ...baseSearchTokens,
      ...dimensionTokens,
      ...expandTokenAliases(baseSearchTokens),
    ]);
    const codeLikeTokens = unique(
      searchTokens.filter((token) => isCodeLikeSearchToken(token))
    );
    const textTokens = unique(
      searchTokens.filter((token) => /[a-z]/.test(token) && !isDimensionToken(token) && !isCodeLikeSearchToken(token))
    );
    const brandTokens = textTokens.filter(
      (token) => /^[a-z][a-z-]{3,}$/.test(token) && !NON_BRAND_TOKENS.has(token)
    );
    const normalizedCodeHints = extractNormalizedCodeHints(normalizedQuery);
    const requiredAnchorTokens = extractProductFamilyAnchorTokens(searchTokens);

    return {
      normalizedQuery,
      searchTokens,
      textTokens,
      brandTokens,
      dimensionTokens,
      codeLikeTokens,
      normalizedCodeHints,
      requiredAnchorTokens,
      exactCodeQuery:
        searchTokens.length === 1 && codeLikeTokens.length === 1 ? (codeLikeTokens[0] ?? "") : "",
      phrasePattern: normalizedQuery ? `%${normalizedQuery}%` : "",
    };
  }

  private getMinimumScore(parts: SearchQueryParts): number {
    if (parts.normalizedCodeHints.length > 0) {
      return 80;
    }

    if (parts.dimensionTokens.length > 0 && parts.textTokens.length > 0) {
      return 70;
    }

    if (parts.dimensionTokens.length > 0) {
      return 50;
    }

    return 35;
  }

  private resolveStatus(matches: ProductSearchMatch[]): ProductMatchStatus {
    return resolveProductMatchStatus(matches);
  }
}

export function getDatabaseConfigFromEnv(): DatabaseConfig {
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!database || !user || !password) {
    throw new Error("Missing required database environment variables.");
  }

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || "5432"),
    database,
    user,
    password,
  };
}

export function normalizeProductSearchText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[:"'`,;]/g, " ")
    .replace(/[()]/g, " ")
    .replace(
      /\b(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in)\b/g,
      "$1-$2$3"
    )
    .replace(/\b(\d+(?:\.\d+)?)\s+(mm|cm|m|inch|in)\b/g, "$1$2")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(input: string): string {
  return normalizeProductSearchText(input);
}

export function extractDimensionTokens(input: string): string[] {
  const matches = input.match(/\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|cm|m|inch|in)\b/g) ?? [];
  const linkedUnitLists = [...input.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:&|and|,)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in)\b/g)].flatMap(
    (match) => {
      const firstValue = match[1];
      const secondValue = match[2];
      const unit = match[3];

      if (!firstValue || !secondValue || !unit) {
        return [];
      }

      return [`${firstValue}${unit}`, `${secondValue}${unit}`];
    }
  );
  const inferredMetricRanges = (
    input.match(/\b\d+(?:\.\d+)?[/-]\d+(?:\.\d+)?\b/g) ?? []
  ).flatMap((match) => {
    const [rawStartValue, rawEndValue] = match.split(/[/-]/);
    if (!rawStartValue || !rawEndValue) {
      return [];
    }

    const startValue = Number(rawStartValue);
    const endValue = Number(rawEndValue);
    if (
      !Number.isFinite(startValue) ||
      !Number.isFinite(endValue) ||
      startValue > endValue ||
      (startValue !== 0 && endValue > 100)
    ) {
      return [];
    }

    const start = formatDimensionNumber(startValue);
    const end = formatDimensionNumber(endValue);
    return [`${start}-${end}mm`, `${start}-${end}`];
  });

  return unique([...matches.map((match) => match.replace(/\s+/g, "")), ...linkedUnitLists, ...inferredMetricRanges]);
}

export function isCodeLikeSearchToken(token: string): boolean {
  return /[a-z]/.test(token) && /\d/.test(token) && !isDimensionToken(token);
}

export function extractProductFamilyAnchorTokens(tokens: string[]): string[] {
  return unique(tokens.flatMap((token) => PRODUCT_FAMILY_ANCHOR_ALIASES.get(token) ?? []));
}

export function productMatchesAnchorTokens(
  product: Pick<ProductSearchMatch, "description" | "code">,
  anchorTokens: string[]
): boolean {
  if (anchorTokens.length === 0) {
    return true;
  }

  const searchableText = `${product.description ?? ""} ${product.code ?? ""}`.toLowerCase();
  return anchorTokens.some((anchorToken) => searchableText.includes(anchorToken));
}

export function extractNormalizedCodeHints(input: string): string[] {
  const compactInput = input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const separatedMatches = input.match(/\b[a-z0-9]*\d+[a-z0-9]*(?:[\/-][a-z0-9]*\d+[a-z0-9]*)+\b/gi) ?? [];
  const compactMatches = compactInput.match(/\b(?=[a-z0-9]*\d)[a-z0-9]{5,}\b/g) ?? [];

  return unique(
    [...separatedMatches, ...compactMatches]
      .map(normalizeCodeHint)
      .filter((hint) => hint.length >= 5 && /\d/.test(hint))
  );
}

export function normalizeCodeHint(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function getNormalizedCodeMatchReason(
  queryCodeHint: string,
  productCode: string | null | undefined
): "normalized_exact_code" | "normalized_code_prefix" | "normalized_code_contains" | null {
  const normalizedQueryCode = normalizeCodeHint(queryCodeHint);
  const normalizedProductCode = normalizeCodeHint(productCode ?? "");

  if (!normalizedQueryCode || !normalizedProductCode) {
    return null;
  }

  if (normalizedProductCode === normalizedQueryCode) {
    return "normalized_exact_code";
  }

  if (normalizedProductCode.startsWith(normalizedQueryCode)) {
    return "normalized_code_prefix";
  }

  if (normalizedProductCode.includes(normalizedQueryCode)) {
    return "normalized_code_contains";
  }

  return null;
}

export function resolveProductMatchStatus(matches: ProductSearchMatch[]): ProductMatchStatus {
  if (matches.length === 0) {
    return "no_match";
  }

  if (matches.length === 1) {
    return "matched";
  }

  const [topMatch, secondMatch] = matches;
  if (!topMatch || !secondMatch) {
    return "matched";
  }

  if (topMatch.score >= 120 && topMatch.score - secondMatch.score >= 30) {
    return "matched";
  }

  return "ambiguous";
}

function expandTokenAliases(tokens: string[]): string[] {
  return tokens.flatMap((token) => TOKEN_ALIASES.get(token) ?? []);
}

function isDimensionToken(token: string): boolean {
  return /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|cm|m|inch|in)$/.test(token);
}

function formatDimensionNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "").replace(/\.$/, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function toNumberOrNull(value: string | number | null): number | null {
  if (value == null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
