export type PdfRFQEmail = {
  subject?: string | null;
  from?: string | null;
  date?: Date | string | null;
  snippet?: string | null;
  status?: string | null;
};

export type PdfRFQMatch = {
  brand: string | null;
  description: string | null;
  code: string | null;
  price: number | null;
  hsnCode: string | null;
  gstRate: number | null;
  tax?: { code: string | null; rate: number | null; label: string };
  isTopSeller?: boolean;
  score: number;
  matchReasons: string[];
};

export type PdfRFQSearchResult = {
  query: { name: string; quantity: number };
  status: "matched" | "ambiguous" | "no_match";
  matchedBrand: string | null;
  matches: PdfRFQMatch[];
};

export type PdfRFQ = {
  _id: unknown;
  emailId?: PdfRFQEmail | null;
  isRFQ: boolean;
  isProcessed: boolean;
  customer?: {
    name: string;
    company: string;
    email: string;
    contactNumber: string | null;
    address: string | null;
  } | null;
  queryProducts?: Array<{ name: string; quantity: number }>;
  searchResults?: PdfRFQSearchResult[];
  errorMessage?: string | null;
  createdAt: Date | string;
};
