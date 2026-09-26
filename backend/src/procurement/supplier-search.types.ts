export const SUPPLIER_SEARCH_PROVIDER_IDS = ["indiamart_mock"] as const;
export type SupplierSearchProviderId = (typeof SUPPLIER_SEARCH_PROVIDER_IDS)[number];

export type SupplierBusinessType = "manufacturer" | "distributor" | "trader" | "retailer";

export interface SupplierProfile {
  id: string;
  name: string;
  businessType: SupplierBusinessType;
  city: string;
  state: string;
  gstNumber: string | null;
  gstVerified: boolean;
  verifiedSupplier: boolean;
  yearsInBusiness: number | null;
  /** Share of buyer enquiries answered, 0-1. */
  responseRate: number | null;
  /** Buyer rating out of 5. */
  rating: number | null;
}

/** One product listing returned by a directory, normalized across providers. */
export interface SupplierListing {
  listingId: string;
  provider: SupplierSearchProviderId;
  supplier: SupplierProfile;
  title: string;
  brand: string | null;
  modelNumber: string | null;
  description: string | null;
  specifications: Record<string, string>;
  price: number | null;
  /** Unit the listed price applies to, as written by the seller ("Piece", "Box", "Set"). */
  priceUnit: string | null;
  /** How many requested units one price unit covers. Null when the listing doesn't say. */
  unitsPerPriceUnit: number | null;
  minOrderQuantity: number | null;
  minOrderUnit: string | null;
  leadTimeDays: number | null;
  url: string | null;
}

export interface SupplierSearchQuery {
  query: string;
  brand?: string | null;
  limit?: number;
}

export interface SupplierSearchProvider {
  id: SupplierSearchProviderId;
  label: string;
  search(query: SupplierSearchQuery): Promise<SupplierListing[]>;
}
