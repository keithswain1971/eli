import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

// import { supabaseAdmin } from '../lib/supabase';

async function testRpc() {
    console.log('🧪 Testing match_chunks RPC...');

    // Dynamic import to ensure env vars are loaded
    const { supabaseAdmin } = await import('../lib/supabase');

    // 1. Get a real embedding from the DB to query with
    const { data: embData, error: embError } = await supabaseAdmin
        .from('eli_embeddings')
        .select('embedding')
        .limit(1)
        .single();

    if (embError) {
        console.error('❌ Could not get test embedding:', embError);
        return;
    }

    const testEmbedding = embData.embedding;
    console.log(`📊 Got test embedding (length: ${testEmbedding.length})`);

    // 2. Call RPC
    console.log('🚀 Calling find_similar_chunks...');
    const { data, error } = await supabaseAdmin.rpc('find_similar_chunks', {
        query_embedding: testEmbedding, // Pass array directly
        match_threshold: -0.5,
        match_count: 5
    });

    if (error) {
        console.error('❌ RPC Failed:', error);
    } else {
        console.log(`✅ RPC Success! Found ${data.length} results.`);
        if (data.length > 0) {
            console.log('   First result:', data[0].title, `(similarity: ${data[0].similarity})`);
        }
    }
}

testRpc().catch(console.error);
