import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

import OpenAI from 'openai';
import { supabaseAdmin } from '../lib/supabase';

async function testVectorSearch() {
    console.log('🧪 Testing Vector Search with TEXT-based RPC\n');

    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generate embedding for test query
    const testQuery = "What is the AI usage policy?";
    console.log(`📝 Test query: "${testQuery}"`);

    const embeddingResponse = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: testQuery
    });
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`✅ Generated embedding: ${embedding.length} dimensions\n`);

    // Convert to PostgreSQL vector text format
    const query_embedding_text = `[${embedding.join(',')}]`;
    console.log(`📤 Sending to RPC as TEXT parameter`);
    console.log(`   First 60 chars: ${query_embedding_text.substring(0, 60)}...\n`);

    // Call the TEXT-based RPC function
    const { data, error } = await supabaseAdmin.rpc('match_chunks', {
        query_embedding_text,
        match_threshold: 0.0,
        match_count: 5,
    });

    if (error) {
        console.error('❌ RPC Error:', error);
        console.error('\n📋 Fallback: Testing if function exists...');

        const { data: fnCheck, error: fnError } = await supabaseAdmin.rpc('execute', {
            sql: `SELECT proname FROM pg_proc WHERE proname = 'match_chunks'`
        });

        if (fnError) {
            console.error('Could not verify function:', fnError);
        } else {
            console.log('Function exists:', fnCheck);
        }
        return;
    }

    console.log(`\n✅ SUCCESS! RPC returned ${data?.length || 0} results\n`);

    if (data && data.length > 0) {
        console.log('📊 Top Results:');
        data.forEach((result: any, i: number) => {
            console.log(`\n${i + 1}. ${result.title}`);
            console.log(`   Similarity: ${result.similarity.toFixed(4)}`);
            console.log(`   URL: ${result.url || 'N/A'}`);
            console.log(`   Content (first 100 chars): ${result.content.substring(0, 100)}...`);
        });
    } else {
        console.log('⚠️  No results found - checking database...');

        const { data: countData } = await supabaseAdmin
            .from('eli_embeddings')
            .select('id', { count: 'exact', head: true });

        console.log(`   Database has ${countData || 0} embeddings`);
    }
}

testVectorSearch().catch(console.error);
