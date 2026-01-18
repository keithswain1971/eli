import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

import OpenAI from 'openai';
import { supabaseAdmin } from '../lib/supabase';

async function testEmbeddingMatch() {
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generate embedding for a test query
    const testQuery = "What is the AI usage policy?";
    console.log('🔍 Generating embedding for:', testQuery);

    const embeddingResponse = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: testQuery.replace(/\n/g, ' ')
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('   Embedding length:', queryEmbedding.length);

    // Call match_chunks with this embedding
    console.log('\n🔎 Calling match_chunks RPC...');
    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 5,
    } as any);

    if (error) {
        console.error('❌ RPC Error:', error);
    } else {
        console.log('✅ RPC returned:', data?.length || 0, 'results');
        if (data && data.length > 0) {
            console.log('\n📄 Results:');
            data.forEach((result: any, i: number) => {
                console.log(`${i + 1}. ${result.title} (similarity: ${result.similarity})`);
                console.log('   Content preview:', result.content.substring(0, 100));
            });
        } else {
            console.log('\n⚠️  No results found!');
            console.log('   This means embeddings are not matching.');
            console.log('   Checking database embeddings...');

            const { data: embData } = await supabaseAdmin
                .from('eli_embeddings')
                .select('id, chunk_id')
                .limit(1);
            console.log('   Embeddings in DB:', embData?.length || 0);
        }
    }
}

testEmbeddingMatch().catch(console.error);
