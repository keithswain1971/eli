import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function checkDatabase() {
    const { supabaseAdmin } = await import('../lib/supabase');

    console.log('🔍 Checking database contents...\n');

    // Check documents
    const { data: docs, error: docsError } = await supabaseAdmin
        .schema('eli')
        .from('documents')
        .select('*');

    if (docsError) {
        console.error('❌ Error fetching documents:', docsError);
    } else {
        console.log(`📄 Documents table: ${docs?.length || 0} records`);
        if (docs && docs.length > 0) {
            console.log('   Sample:', docs[0].title, '(', docs[0].source_type, ')');
        }
    }

    // Check chunks
    const { data: chunks, error: chunksError } = await supabaseAdmin
        .schema('eli')
        .from('chunks')
        .select('*');

    if (chunksError) {
        console.error('❌ Error fetching chunks:', chunksError);
    } else {
        console.log(`\n📑 Chunks table: ${chunks?.length || 0} records`);
    }

    // Check embeddings
    const { data: embeddings, error: embError } = await supabaseAdmin
        .schema('eli')
        .from('embeddings')
        .select('chunk_id');

    if (embError) {
        console.error('❌ Error fetching embeddings:', embError);
    } else {
        console.log(`\n🔢 Embeddings table: ${embeddings?.length || 0} records`);
    }

    // Check if match_chunks RPC exists
    console.log('\n🔧 Testing match_chunks RPC function...');
    const testEmbedding = new Array(1536).fill(0.1); // Test embedding

    const { data: matches, error: rpcError } = await supabaseAdmin.rpc('match_chunks', {
        query_embedding: testEmbedding,
        match_threshold: 0.1,
        match_count: 3,
    } as any);

    if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
    } else {
        console.log(`✅ RPC works! Returned ${matches?.length || 0} matches`);
        if (matches && matches.length > 0) {
            console.log('   Sample match:', matches[0]);
        }
    }
}

checkDatabase().catch(console.error);
