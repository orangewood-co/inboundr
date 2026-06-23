export interface Product {
  id: string;
  organization_id: string;
  brand: string;
  maxdiscount: number;
  productdescription: string;
  productcode: string;
  unitprice: number;
  hsncode: string;
  gstrate: number;
  productlink: string;
  maxupsell: number;
  calibrationcharges: number;
  unit: string;
  is_top_seller: boolean;
  addedtime: Date;
  addeduser: string;
  embedding?: number[];
  embedding_model?: string;
  embedding_updated_at?: Date;
  embedding_task?: string;
}

export interface SearchResult {
  id: string;
  brand: string;
  description: string;
  code: string;
  price: number;
  hsnCode: string;
  gstRate: number;
  link: string;
  similarity: number;
  similarityPercentage: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export type TaskType =
  | 'RETRIEVAL_QUERY'
  | 'RETRIEVAL_DOCUMENT'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING';