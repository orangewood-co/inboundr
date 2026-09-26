import { createHash } from "node:crypto";
import type {
  SupplierListing,
  SupplierProfile,
  SupplierSearchProvider,
  SupplierSearchQuery,
} from "./supplier-search.types";

const SUPPLIER_POOL: SupplierProfile[] = [
  supplier("sup-001", "Sri Balaji Industrial Supplies", "distributor", "Chennai", "Tamil Nadu", "33", true, true, 14, 0.92, 4.5),
  supplier("sup-002", "Precision Tools Corporation", "distributor", "Mumbai", "Maharashtra", "27", true, true, 22, 0.88, 4.4),
  supplier("sup-003", "Kaveri Engineering Traders", "trader", "Bengaluru", "Karnataka", "29", true, false, 8, 0.74, 4.1),
  supplier("sup-004", "Ahmedabad Machine Tools", "distributor", "Ahmedabad", "Gujarat", "24", true, true, 17, 0.81, 4.2),
  supplier("sup-005", "Delhi Hardware Mart", "retailer", "New Delhi", "Delhi", "07", true, false, 6, 0.63, 3.8),
  supplier("sup-006", "Coimbatore Tooling Centre", "distributor", "Coimbatore", "Tamil Nadu", "33", true, true, 11, 0.9, 4.6),
  supplier("sup-007", "Pune Industrial Hub", "trader", "Pune", "Maharashtra", "27", false, false, 3, 0.55, 3.6),
  supplier("sup-008", "Eastern Engineering Co.", "distributor", "Kolkata", "West Bengal", "19", true, false, 26, 0.7, 4.0),
  supplier("sup-009", "Hyderabad Instruments & Controls", "distributor", "Hyderabad", "Telangana", "36", true, true, 9, 0.86, 4.3),
  supplier("sup-010", "Ludhiana Tool House", "manufacturer", "Ludhiana", "Punjab", "03", true, true, 19, 0.78, 4.2),
  supplier("sup-011", "Rajkot Precision Works", "manufacturer", "Rajkot", "Gujarat", "24", true, false, 12, 0.69, 4.0),
  supplier("sup-012", "Metro Trade Links", "trader", "Mumbai", "Maharashtra", "27", false, false, 2, 0.41, 3.2),
  supplier("sup-013", "National Industrial Stores", "retailer", "Chennai", "Tamil Nadu", "33", true, false, 31, 0.6, 3.9),
  supplier("sup-014", "Vishwakarma Enterprises", "manufacturer", "Jaipur", "Rajasthan", "08", true, true, 15, 0.83, 4.4),
  supplier("sup-015", "Om Sai Trading Company", "trader", "Thane", "Maharashtra", "27", false, false, null, null, null),
  supplier("sup-016", "QuickShip Online Retail", "retailer", "Noida", "Uttar Pradesh", "09", false, false, 1, 0.35, 3.1),
];

const ALTERNATE_BRANDS = ["Kristeel", "Apex", "Precise", "Unique", "Techno", "Venus", "Supreme", "Royal"];
const OFF_TYPE_SUFFIXES = ["Repair Service", "Spare Parts Kit", "Calibration Service", "Storage Case"];
const ORIGINS = ["India", "India", "India", "Japan", "China", "Germany"];
const DIMENSION_PATTERN =
  /(\d+(?:\.\d+)?)\s?(mm|cm|m|inch|in|kg|g|ml|l|v|kw|hp|a|w|bar|psi)\b/gi;

function supplier(
  id: string,
  name: string,
  businessType: SupplierProfile["businessType"],
  city: string,
  state: string,
  stateCode: string,
  gstVerified: boolean,
  verifiedSupplier: boolean,
  yearsInBusiness: number | null,
  responseRate: number | null,
  rating: number | null
): SupplierProfile {
  const pan = createHash("sha1").update(name).digest("hex").slice(0, 5).toUpperCase().replace(/[0-9]/g, "A");
  return {
    id,
    name,
    businessType,
    city,
    state,
    gstNumber: gstVerified || id.endsWith("7") ? `${stateCode}${pan}0${id.slice(-3)}F1Z${id.slice(-1)}` : null,
    gstVerified,
    verifiedSupplier,
    yearsInBusiness,
    responseRate,
    rating,
  };
}

function seededRandom(seed: string): () => number {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)]!;
}

function titleCase(value: string): string {
  return value.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
}

function withoutBrand(query: string, brand: string | null): string {
  if (!brand) return query;
  return query.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "").replace(/\s+/g, " ").trim();
}

function shiftDimension(value: string, random: () => number): string {
  return value.replace(DIMENSION_PATTERN, (_match, amount: string, unit: string) => {
    const factor = pick(random, [0.5, 2, 1.5, 3]);
    const shifted = Math.round(Number(amount) * factor * 10) / 10;
    return `${shifted}${unit.toLowerCase()}`;
  });
}

function dimensionSpec(value: string): string | null {
  const match = value.match(DIMENSION_PATTERN);
  return match ? match.join(", ") : null;
}

function searchUrl(title: string): string {
  return `https://www.indiamart.com/search.mp?ss=${encodeURIComponent(title)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createIndiaMartMockProvider(): SupplierSearchProvider {
  return {
    id: "indiamart_mock",
    label: "IndiaMART (mock)",
    async search({ query, brand = null, limit = 10 }: SupplierSearchQuery): Promise<SupplierListing[]> {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) return [];

      const random = seededRandom(`${trimmedQuery.toLowerCase()}|${(brand ?? "").toLowerCase()}`);
      await sleep(250 + Math.floor(random() * 500));

      const baseProduct = titleCase(withoutBrand(trimmedQuery, brand) || trimmedQuery);
      const hasDimension = DIMENSION_PATTERN.test(baseProduct);
      DIMENSION_PATTERN.lastIndex = 0;
      const basePrice = Math.round((400 + random() * 9600) / 10) * 10;
      const count = Math.min(limit, 6 + Math.floor(random() * 6));
      const listings: SupplierListing[] = [];

      for (let index = 0; index < count; index += 1) {
        const seller = pick(random, SUPPLIER_POOL);
        const roll = random();
        let listingBrand: string | null = brand ?? pick(random, ALTERNATE_BRANDS);
        let product = baseProduct;

        if (roll < 0.4) {
          // Exact match: requested brand and specification.
        } else if (roll < 0.65) {
          listingBrand = pick(random, ALTERNATE_BRANDS.filter((name) => name !== brand));
        } else if (roll < 0.85 && hasDimension) {
          product = shiftDimension(baseProduct, random);
        } else {
          product = `${baseProduct} ${pick(random, OFF_TYPE_SUFFIXES)}`;
        }

        const title = [listingBrand, product].filter(Boolean).join(" ");
        const priceRoll = random();
        const unitPriceValue = Math.round(basePrice * (0.75 + random() * 0.65));
        let price: number | null = unitPriceValue;
        let priceUnit: string | null = "Piece";
        let unitsPerPriceUnit: number | null = 1;

        if (priceRoll < 0.25) {
          price = null;
          priceUnit = null;
          unitsPerPriceUnit = null;
        } else if (priceRoll < 0.33) {
          price = unitPriceValue * 10;
          priceUnit = "Box of 10";
          unitsPerPriceUnit = 10;
        } else if (priceRoll < 0.4) {
          price = unitPriceValue * 5;
          priceUnit = "Box";
          unitsPerPriceUnit = null;
        }

        const moqRoll = random();
        const minOrderQuantity = moqRoll < 0.6 ? 1 : moqRoll < 0.85 ? 5 + Math.floor(random() * 6) : 50 + Math.floor(random() * 51);
        const size = dimensionSpec(product);
        const origin = pick(random, ORIGINS);
        const specifications: Record<string, string> = {
          ...(listingBrand ? { Brand: listingBrand } : {}),
          ...(size ? { Size: size } : {}),
          "Country of Origin": origin,
        };
        const listingId = createHash("sha1").update(`${seller.id}|${title}|${index}`).digest("hex").slice(0, 12);

        listings.push({
          listingId,
          provider: "indiamart_mock",
          supplier: seller,
          title,
          brand: listingBrand,
          modelNumber: random() < 0.35 ? `${(listingBrand ?? "GN").slice(0, 2).toUpperCase()}-${100 + Math.floor(random() * 900)}` : null,
          description: `${title} available from ${seller.name}, ${seller.city}. ${origin === "India" ? "Made in India." : `Imported from ${origin}.`}`,
          specifications,
          price,
          priceUnit,
          unitsPerPriceUnit,
          minOrderQuantity,
          minOrderUnit: minOrderQuantity === 1 ? "Piece" : "Pieces",
          leadTimeDays: random() < 0.3 ? null : 2 + Math.floor(random() * 20),
          // The mock has no real listing pages, so links open a live IndiaMART search for the title.
          url: searchUrl(title),
        });
      }

      return listings;
    },
  };
}
