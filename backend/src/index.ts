import 'dotenv/config';
import { GeminiProductEmbedder } from './embeddings';

async function main() {
  // Configuration
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'your_database',
    user: process.env.DB_USER || 'your_user',
    password: process.env.DB_PASSWORD || 'your_password',
  };

  // Initialize embedder
  const embedder = new GeminiProductEmbedder(
    process.env.GCP_PROJECT_ID!,
    process.env.GCP_LOCATION || 'us-central1',
    dbConfig
  );

  try {
    // Check current embedding status
    const stats = await embedder.getEmbeddingStats();
    console.log('📊 Embedding Statistics:');
    console.log(`   Total products: ${stats.total}`);
    console.log(`   With embeddings: ${stats.withEmbeddings}`);
    console.log(`   Missing embeddings: ${stats.missingEmbeddings}`);
    console.log(`   Completion: ${stats.completionPercentage}%\n`);

    // Generate embeddings for products without them
    if (stats.missingEmbeddings > 0) {
      console.log('🔄 Generating embeddings...');
      await embedder.generateProductEmbeddings(
        50, // batch size
        'RETRIEVAL_DOCUMENT'
      );
    }

    // Search example
    console.log('\n🔍 Searching for products...');
    const results = await embedder.searchProducts(
      'Looking for iPhone 15 Pro Max 256GB',
      5,
      'RETRIEVAL_QUERY',
      0.5
    );

    console.log('\n📋 Search Results:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.brand} - ${result.description.substring(0, 60)}...`);
      console.log(`   Code: ${result.code}`);
      console.log(`   Price: ₹${result.price}`);
      console.log(`   Similarity: ${result.similarityPercentage}`);
    });

    // Hybrid search example
    console.log('\n🔍 Hybrid search...');
    const hybridResults = await embedder.hybridSearch('iphone', 5);
    console.log(`Found ${hybridResults.length} products using hybrid search`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await embedder.close();
  }
}

main();