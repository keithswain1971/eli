
import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });
import OpenAI from 'openai';
// Don't import at top level to avoid hoisting before dotenv
// import { findRelevantChunks } from '../lib/vector-store';

async function testLocalSearch() {
    console.log('🧪 Testing Local In-Memory Search...');

    // Import HERE after dotenv has run
    const { findRelevantChunks } = await import('../lib/vector-store');

    // 1. Generate Query Vector
    const queryText = "What is the AI usage policy?";
    console.log(`\n1️⃣ Generating embedding for query: "${queryText}"`);

    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText.replace(/\n/g, ' ')
    });
    const queryVector = embeddingResponse.data[0].embedding;

    // 2. Run Search
    console.log('\n2️⃣ Running findRelevantChunks (New In-Memory Implementation)...');
    const start = Date.now();
    const results = await findRelevantChunks(queryVector);
    const end = Date.now();

    console.log(`\n⏱️ Search took ${end - start}ms`);
    console.log(`✅ Found ${results.length} results`);

    results.forEach((r, i) => {
        console.log(`   [${i + 1}] ${r.title} (Score: ${r.similarity.toFixed(4)})`);
    });
}

testLocalSearch().catch(console.error);
