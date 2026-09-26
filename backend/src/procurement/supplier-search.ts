import type { Types } from "mongoose";
import { ProcurementSearchCache } from "../models/procurement-search-cache.model";
import { createIndiaMartMockProvider } from "./indiamart-mock.provider";
import type { SupplierListing, SupplierSearchProvider, SupplierSearchQuery } from "./supplier-search.types";

let provider: SupplierSearchProvider | null = null;

export function getSupplierSearchProvider(): SupplierSearchProvider {
  if (provider) return provider;
  const configured = process.env.PROCUREMENT_SEARCH_PROVIDER?.trim() || "indiamart_mock";
  switch (configured) {
    case "indiamart_mock":
      provider = createIndiaMartMockProvider();
      return provider;
    default:
      throw new Error(`Unsupported procurement search provider: ${configured}`);
  }
}

function cacheTtlMs(): number {
  const hours = Number(process.env.PROCUREMENT_SEARCH_CACHE_HOURS);
  return (Number.isFinite(hours) && hours >= 0 ? hours : 72) * 60 * 60 * 1000;
}

function queryKey(query: SupplierSearchQuery): string {
  const normalize = (value: string | null | undefined) => (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return `${normalize(query.query)}|${normalize(query.brand)}|${query.limit ?? ""}`;
}

export async function searchSuppliersCached(
  organizationId: Types.ObjectId,
  query: SupplierSearchQuery
): Promise<{ listings: SupplierListing[]; fromCache: boolean }> {
  const searchProvider = getSupplierSearchProvider();
  const key = queryKey(query);
  const ttl = cacheTtlMs();

  if (ttl > 0) {
    const cached = await ProcurementSearchCache.findOne({
      organizationId,
      provider: searchProvider.id,
      queryKey: key,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (cached) return { listings: cached.listings as SupplierListing[], fromCache: true };
  }

  const listings = await searchProvider.search(query);

  if (ttl > 0) {
    await ProcurementSearchCache.updateOne(
      { organizationId, provider: searchProvider.id, queryKey: key },
      { $set: { listings, expiresAt: new Date(Date.now() + ttl) } },
      { upsert: true }
    ).catch((error: unknown) => {
      // Two runs caching the same query at once collide on the unique index; either copy is fine.
      if ((error as { code?: number })?.code !== 11000) throw error;
    });
  }

  return { listings, fromCache: false };
}
