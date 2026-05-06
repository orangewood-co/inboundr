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

export type ProductMatchStatus = "matched" | "ambiguous" | "no_match";

export interface ProductSearchMatch {
  id: number;
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  link: string | null;
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
  productlink: string | null;
  rank_score: string | number;
  match_reasons: string[] | null;
}

interface SearchQueryParts {
  normalizedQuery: string;
  searchTokens: string[];
  brandTokens: string[];
  dimensionTokens: string[];
  codeLikeTokens: string[];
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
      p.productlink,
      CASE
        WHEN $1 <> '' AND lower(COALESCE(p.productcode, '')) = $1 THEN 220
        ELSE 0
      END AS exact_code_score,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM unnest($2::text[]) AS pattern
          WHERE lower(COALESCE(p.productcode, '')) LIKE pattern
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
        WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || dimension_token || '%'
           OR lower(COALESCE(p.productcode, '')) LIKE '%' || dimension_token || '%'
      ), 0) AS dimension_score
    FROM products p
    WHERE
      (
        ($4 <> '' AND lower(COALESCE(p.productdescription, '')) LIKE $5)
        OR EXISTS (
          SELECT 1
          FROM unnest($6::text[]) AS token
          WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || token || '%'
             OR lower(COALESCE(p.brand, '')) LIKE '%' || token || '%'
             OR lower(COALESCE(p.productcode, '')) LIKE '%' || token || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($7::text[]) AS dimension_token
          WHERE lower(COALESCE(p.productdescription, '')) LIKE '%' || dimension_token || '%'
             OR lower(COALESCE(p.productcode, '')) LIKE '%' || dimension_token || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM unnest($2::text[]) AS pattern
          WHERE lower(COALESCE(p.productcode, '')) LIKE pattern
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
        + partial_code_score
        + brand_score
        + phrase_score
        + token_score
        + dimension_score AS rank_score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN exact_code_score > 0 THEN 'exact_code' END,
        CASE WHEN partial_code_score > 0 THEN 'partial_code' END,
        CASE WHEN brand_score > 0 THEN 'brand' END,
        CASE WHEN phrase_score > 0 THEN 'full_phrase' END,
        CASE WHEN token_score > 0 THEN 'token_overlap' END,
        CASE WHEN dimension_score > 0 THEN 'dimension' END
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
    productlink,
    rank_score,
    match_reasons
  FROM scored_products
  WHERE rank_score >= $8
  ORDER BY rank_score DESC, char_length(COALESCE(productdescription, '')) ASC, id ASC
  LIMIT $9
`;

export class TextProductSearcher {
  private pool: Pool;

  constructor(dbConfig: DatabaseConfig) {
    this.pool = new Pool(dbConfig);
  }

  async searchProduct(
    query: { name: string; quantity: number },
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
        this.getMinimumScore(parts),
        limit,
      ]);

      const matches = result.rows.map((row) => ({
        id: row.id,
        brand: row.brand,
        description: row.productdescription,
        code: row.productcode,
        price: toNumberOrNull(row.unitprice),
        hsnCode: row.hsncode,
        gstRate: toNumberOrNull(row.gstrate),
        link: row.productlink,
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
    const searchTokens = unique(
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
    const brandTokens = searchTokens.filter((token) => /^[a-z][a-z-]{3,}$/.test(token));
    const codeLikeTokens = unique(
      searchTokens.filter((token) => /[a-z]/.test(token) && /\d/.test(token))
    );

    return {
      normalizedQuery,
      searchTokens,
      brandTokens,
      dimensionTokens,
      codeLikeTokens,
      exactCodeQuery:
        searchTokens.length === 1 && codeLikeTokens.length === 1 ? (codeLikeTokens[0] ?? "") : "",
      phrasePattern: normalizedQuery ? `%${normalizedQuery}%` : "",
    };
  }

  private getMinimumScore(parts: SearchQueryParts): number {
    if (parts.dimensionTokens.length > 0 && parts.brandTokens.length > 0) {
      return 70;
    }

    if (parts.dimensionTokens.length > 0) {
      return 50;
    }

    return 35;
  }

  private resolveStatus(matches: ProductSearchMatch[]): ProductMatchStatus {
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

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/["'`,]/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDimensionTokens(input: string): string[] {
  const matches = input.match(/\b\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?(?:mm|cm|m|inch|in)\b/g) ?? [];
  return unique(matches.map((match) => match.replace(/\s+/g, "")));
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
