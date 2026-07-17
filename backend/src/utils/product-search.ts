import { Pool } from "pg";
import type { DatabaseConfig } from "../types";

const DEFAULT_STOP_WORDS = new Set([
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

export interface ProductSearchProfile {
  synonyms?: Record<string, string[]>;
  stopWords?: string[];
  matchThreshold?: number;
  ambiguityGap?: number;
  taxLabel?: string;
  searchableAttributeKeys?: string[];
}

export type ProductMatchStatus = "matched" | "ambiguous" | "no_match";

export interface ProductSearchMatch {
  id: string;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  calibrationCharges: number | null;
  tax: { code: string | null; rate: number | null; label: string };
  attributes: Record<string, string | number | boolean | null>;
  defaultAdjustments: Array<{
    id: string;
    code: string;
    label: string;
    type: "fixed" | "percentage";
    value: number;
    taxable: boolean;
  }>;
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
  id: string;
  brand: string | null;
  productdescription: string | null;
  productcode: string | null;
  unitprice: string | number | null;
  hsncode: string | null;
  gstrate: string | number | null;
  calibrationcharges: string | number | null;
  attributes: Record<string, string | number | boolean | null> | null;
  default_adjustments: ProductSearchMatch["defaultAdjustments"] | null;
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
      p.id::text AS id,
      p.brand,
      p.productdescription,
      p.productcode,
      p.unitprice,
      p.hsncode,
      p.gstrate,
      p.calibrationcharges,
      p.attributes,
      p.default_adjustments,
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
           OR lower(COALESCE(p.category, '')) LIKE '%' || token || '%'
           OR EXISTS (
             SELECT 1 FROM unnest($15::text[]) AS attribute_key
             WHERE lower(COALESCE(p.attributes ->> attribute_key, '')) LIKE '%' || token || '%'
           )
           OR lower(COALESCE(array_to_string(p.tags, ' '), '')) LIKE '%' || token || '%'
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
      AND (NOT $14::boolean OR COALESCE(p.is_top_seller, false))
      AND
      (
        cardinality($13::text[]) = 0
        OR EXISTS (
          SELECT 1
          FROM unnest($13::text[]) AS anchor_token
          WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || anchor_token || '%'
             OR lower(COALESCE(p.productcode, '')) LIKE '%' || anchor_token || '%'
             OR lower(COALESCE(p.brand, '')) LIKE '%' || anchor_token || '%'
             OR lower(COALESCE(p.category, '')) LIKE '%' || anchor_token || '%'
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
             OR lower(COALESCE(p.category, '')) LIKE '%' || text_token || '%'
             OR EXISTS (
               SELECT 1 FROM unnest($15::text[]) AS attribute_key
               WHERE lower(COALESCE(p.attributes ->> attribute_key, '')) LIKE '%' || text_token || '%'
             )
             OR lower(COALESCE(array_to_string(p.tags, ' '), '')) LIKE '%' || text_token || '%'
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
    attributes,
    default_adjustments,
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
  private profile: ProductSearchProfile;

  constructor(dbConfig: DatabaseConfig, profile: ProductSearchProfile = {}) {
    this.pool = new Pool(dbConfig);
    this.profile = profile;
  }

  async searchProduct(
    query: { name: string; quantity: number },
    organizationId: string,
    limit: number = 5,
    options: { topSellerOnly?: boolean } = {}
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
        Boolean(options.topSellerOnly),
        this.profile.searchableAttributeKeys ?? [],
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
        tax: {
          code: row.hsncode,
          rate: toNumberOrNull(row.gstrate),
          label: this.profile.taxLabel || "Tax",
        },
        attributes: row.attributes ?? {},
        defaultAdjustments:
          row.default_adjustments ?? legacyCalibrationAdjustment(row.calibrationcharges),
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
        if (DEFAULT_STOP_WORDS.has(token) || this.profile.stopWords?.includes(token)) {
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
      ...expandTokenAliases(baseSearchTokens, this.profile.synonyms),
    ]);
    const codeLikeTokens = unique(
      searchTokens.filter((token) => isCodeLikeSearchToken(token))
    );
    const textTokens = unique(
      searchTokens.filter((token) => /[a-z]/.test(token) && !isDimensionToken(token) && !isCodeLikeSearchToken(token))
    );
    const brandTokens = textTokens.filter((token) => /^[a-z][a-z0-9-]{1,}$/.test(token));
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

    return this.profile.matchThreshold ?? 35;
  }

  private resolveStatus(matches: ProductSearchMatch[]): ProductMatchStatus {
    return resolveProductMatchStatus(matches, this.profile.ambiguityGap);
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
      /\b(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in|ft|kg|g|l|ml|oz|lb|v|w|kw)\b/g,
      "$1-$2$3"
    )
    .replace(/\b(\d+(?:\.\d+)?)\s+(mm|cm|m|inch|in|ft|kg|g|l|ml|oz|lb|v|w|kw)\b/g, "$1$2")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(input: string): string {
  return normalizeProductSearchText(input);
}

export function extractDimensionTokens(input: string): string[] {
  const matches = input.match(/\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|cm|m|inch|in|ft|kg|g|l|ml|oz|lb|v|w|kw)\b/g) ?? [];
  const linkedUnitLists = [...input.matchAll(/\b(\d+(?:\.\d+)?)\s*(?:&|and|,)\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|inch|in|ft|kg|g|l|ml|oz|lb|v|w|kw)\b/g)].flatMap(
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
      startValue > endValue
    ) {
      return [];
    }

    const start = formatDimensionNumber(startValue);
    const end = formatDimensionNumber(endValue);
    return [`${start}-${end}`];
  });

  return unique([...matches.map((match) => match.replace(/\s+/g, "")), ...linkedUnitLists, ...inferredMetricRanges]);
}

export function isCodeLikeSearchToken(token: string): boolean {
  return /[a-z]/.test(token) && /\d/.test(token) && !isDimensionToken(token);
}

export function extractProductFamilyAnchorTokens(tokens: string[]): string[] {
  return unique(tokens.filter((token) =>
    token.length >= 3
    && /[a-z]/.test(token)
    && !DEFAULT_STOP_WORDS.has(token)
    && !isDimensionToken(token)
    && !isCodeLikeSearchToken(token)
  )).slice(0, 4);
}

export function productMatchesAnchorTokens(
  product: Pick<ProductSearchMatch, "description" | "code"> & { brand?: string | null },
  anchorTokens: string[]
): boolean {
  if (anchorTokens.length === 0) {
    return true;
  }

  const searchableText = `${product.description ?? ""} ${product.code ?? ""} ${product.brand ?? ""}`.toLowerCase();
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

export function resolveProductMatchStatus(
  matches: ProductSearchMatch[],
  ambiguityGap: number = 30
): ProductMatchStatus {
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

  if (topMatch.score >= 120 && topMatch.score - secondMatch.score >= ambiguityGap) {
    return "matched";
  }

  return "ambiguous";
}

function expandTokenAliases(
  tokens: string[],
  synonyms: Record<string, string[]> = {}
): string[] {
  return tokens.flatMap((token) => synonyms[token] ?? []);
}

function isDimensionToken(token: string): boolean {
  return /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|cm|m|inch|in|ft|kg|g|l|ml|oz|lb|v|w|kw)$/.test(token);
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

function legacyCalibrationAdjustment(
  value: string | number | null
): ProductSearchMatch["defaultAdjustments"] {
  const amount = toNumberOrNull(value);
  return amount != null && amount > 0
    ? [{
        id: "legacy.calibration",
        code: "calibration",
        label: "Calibration",
        type: "fixed",
        value: amount,
        taxable: false,
      }]
    : [];
}
