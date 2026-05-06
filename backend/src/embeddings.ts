import { VertexAI } from '@google-cloud/vertexai';
import { Pool } from 'pg';
import type { Product, SearchResult, DatabaseConfig, TaskType } from './types';

export class GeminiProductEmbedder {
  private pool: Pool;
  private vertexAI: VertexAI;
  private model: any;

  constructor(
    projectId: string,
    location: string,
    dbConfig: DatabaseConfig
  ) {
    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    // Initialize Gemini Embedding model
    this.model = this.vertexAI.preview.getGenerativeModel({
      model: 'gemini-embedding-2-preview',
    });

    // Initialize PostgreSQL connection pool
    this.pool = new Pool(dbConfig);
  }

  /**
   * Create searchable text from product data
   */
  private createProductText(product: Partial<Product>): string {
    const brand = product.brand || '';
    const description = product.productdescription || '';
    const code = product.productcode || '';

    return `${brand} ${description} ${code}`.trim();
  }

  /**
   * Generate embedding for a single text
   */
  private async generateEmbedding(
    text: string,
    taskType: TaskType = 'RETRIEVAL_DOCUMENT',
    outputDimensionality?: number
  ): Promise<number[]> {
    try {
      const request = {
        contents: [{ role: 'user', parts: [{ text }] }],
      };

      const result = await this.model.generateContent(request);
      const response = result.response;

      // Extract embedding from response
      // Note: Adjust based on actual API response structure
      const embedding = response.candidates[0].content.parts[0].embedding;

      // If output dimensionality is specified, truncate
      if (outputDimensionality && outputDimensionality < embedding.length) {
        return embedding.slice(0, outputDimensionality);
      }

      return embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings using the Vertex AI text embedding API
   */
  private async generateEmbeddings(
    texts: string[],
    taskType: TaskType = 'RETRIEVAL_DOCUMENT'
  ): Promise<number[][]> {
    try {
      // Use the text embedding API endpoint
      const embeddings: number[][] = [];

      // Process in batches to avoid rate limits
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
          batch.map((text) => this.generateEmbedding(text, taskType))
        );
        embeddings.push(...batchEmbeddings);

        // Small delay to avoid rate limiting
        if (i + batchSize < texts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return embeddings;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for all products without embeddings
   */
  async generateProductEmbeddings(
    batchSize: number = 50,
    taskType: TaskType = 'RETRIEVAL_DOCUMENT',
    outputDimensionality?: number
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Fetch products without embeddings
      const result = await client.query<Product>(`
        SELECT id, brand, productdescription, productcode 
        FROM products 
        WHERE embedding IS NULL
        ORDER BY id
      `);

      const products = result.rows;
      const total = products.length;

      console.log(`Processing ${total} products...`);

      for (let i = 0; i < total; i += batchSize) {
        const batch = products.slice(i, i + batchSize);

        // Prepare texts
        const texts = batch.map((p) => this.createProductText(p));
        const productIds = batch.map((p) => p.id);

        try {
          // Generate embeddings
          const embeddings = await this.generateEmbeddings(texts, taskType);

          // Update database
          await client.query('BEGIN');

          for (let j = 0; j < embeddings.length; j++) {
            await client.query(
              `
              UPDATE products 
              SET 
                embedding = $1::vector,
                embedding_task = $2,
                embedding_updated_at = NOW()
              WHERE id = $3
            `,
              [JSON.stringify(embeddings[j]), taskType, productIds[j]]
            );
          }

          await client.query('COMMIT');

          const processed = Math.min(i + batchSize, total);
          console.log(`✓ Processed ${processed}/${total} products`);

          // Rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`✗ Error processing batch ${i}-${i + batchSize}:`, error);
          continue;
        }
      }

      console.log('✓ Embedding generation complete!');
    } finally {
      client.release();
    }
  }

  /**
   * Search for products using semantic similarity
   */
  async searchProducts(
    query: string,
    limit: number = 5,
    taskType: TaskType = 'RETRIEVAL_QUERY',
    minSimilarity: number = 0.5
  ): Promise<SearchResult[]> {
    const client = await this.pool.connect();

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query, taskType);

      // Perform similarity search
      const result = await client.query(
        `
        SELECT 
          id,
          brand,
          productdescription,
          productcode,
          unitprice,
          hsncode,
          gstrate,
          productlink,
          1 - (embedding <=> $1::vector) as similarity
        FROM products
        WHERE 
          embedding IS NOT NULL
          AND (1 - (embedding <=> $1::vector)) >= $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `,
        [JSON.stringify(queryEmbedding), minSimilarity, limit]
      );

      return result.rows.map((row) => ({
        id: row.id,
        brand: row.brand,
        description: row.productdescription,
        code: row.productcode,
        price: parseFloat(row.unitprice),
        hsnCode: row.hsncode,
        gstRate: parseFloat(row.gstrate),
        link: row.productlink,
        similarity: parseFloat(row.similarity),
        similarityPercentage: `${(parseFloat(row.similarity) * 100).toFixed(1)}%`,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Update embedding for a single product
   */
  async updateProductEmbedding(
    productId: number,
    taskType: TaskType = 'RETRIEVAL_DOCUMENT'
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      const result = await client.query<Product>(
        `
        SELECT id, brand, productdescription, productcode 
        FROM products 
        WHERE id = $1
      `,
        [productId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product with id ${productId} not found`);
      }

      const product = result.rows[0] as Partial<Product>;
      const text = this.createProductText(product);

      const embedding = await this.generateEmbedding(text, taskType);

      await client.query(
        `
        UPDATE products 
        SET 
          embedding = $1::vector,
          embedding_task = $2,
          embedding_updated_at = NOW()
        WHERE id = $3
      `,
        [JSON.stringify(embedding), taskType, productId]
      );

      console.log(`✓ Updated embedding for product ${productId}`);
    } finally {
      client.release();
    }
  }

  /**
   * Hybrid search combining semantic and keyword matching
   */
  async hybridSearch(
    query: string,
    limit: number = 10,
    semanticWeight: number = 0.7,
    keywordWeight: number = 0.3
  ): Promise<SearchResult[]> {
    const client = await this.pool.connect();

    try {
      const queryEmbedding = await this.generateEmbedding(query, 'RETRIEVAL_QUERY');

      const result = await client.query(
        `
        WITH semantic_results AS (
          SELECT 
            id,
            (1 - (embedding <=> $1::vector)) * $2 as semantic_score
          FROM products
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> $1::vector
          LIMIT 20
        ),
        keyword_results AS (
          SELECT 
            id,
            $3 as keyword_score
          FROM products
          WHERE 
            LOWER(brand) LIKE LOWER($4) OR
            LOWER(productdescription) LIKE LOWER($4) OR
            LOWER(productcode) LIKE LOWER($4)
        )
        SELECT 
          p.id,
          p.brand,
          p.productdescription,
          p.productcode,
          p.unitprice,
          p.hsncode,
          p.gstrate,
          p.productlink,
          COALESCE(s.semantic_score, 0) + COALESCE(k.keyword_score, 0) as total_score
        FROM products p
        LEFT JOIN semantic_results s ON p.id = s.id
        LEFT JOIN keyword_results k ON p.id = k.id
        WHERE s.id IS NOT NULL OR k.id IS NOT NULL
        ORDER BY total_score DESC
        LIMIT $5
      `,
        [
          JSON.stringify(queryEmbedding),
          semanticWeight,
          keywordWeight,
          `%${query}%`,
          limit,
        ]
      );

      return result.rows.map((row) => ({
        id: row.id,
        brand: row.brand,
        description: row.productdescription,
        code: row.productcode,
        price: parseFloat(row.unitprice),
        hsnCode: row.hsncode,
        gstRate: parseFloat(row.gstrate),
        link: row.productlink,
        similarity: parseFloat(row.total_score),
        similarityPercentage: `${(parseFloat(row.total_score) * 100).toFixed(1)}%`,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    total: number;
    withEmbeddings: number;
    missingEmbeddings: number;
    completionPercentage: number;
  }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as total_products,
          COUNT(embedding) as with_embeddings,
          COUNT(*) - COUNT(embedding) as missing_embeddings,
          ROUND(COUNT(embedding)::numeric / COUNT(*)::numeric * 100, 2) as completion_percentage
        FROM products
      `);

      const row = result.rows[0];
      return {
        total: parseInt(row.total_products),
        withEmbeddings: parseInt(row.with_embeddings),
        missingEmbeddings: parseInt(row.missing_embeddings),
        completionPercentage: parseFloat(row.completion_percentage),
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}