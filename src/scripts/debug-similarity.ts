
import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });
import OpenAI from 'openai';

async function debugSimilarity() {
    console.log('🔍 Starting Vector Similarity Debugger (Ultimate Test)...');

    // 1. Dynamic import of supabase to get env vars loaded first
    const { supabaseAdmin } = await import('../lib/supabase');

    // 2. Generate Query Embedding
    const queryText = "What is the AI usage policy?";
    console.log(`\n1️⃣ Generating embedding for query: "${queryText}"`);

    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: queryText.replace(/\n/g, ' ')
    });
    const queryVector = embeddingResponse.data[0].embedding;

    // 3. Fetch Stored Embedding
    console.log('\n2️⃣ Fetching stored policy embedding from DB...');
    const { data: dbData, error } = await supabaseAdmin
        .from('eli_documents')
        .select(`
            title, 
            eli_chunks (
                content,
                eli_embeddings ( embedding )
            )
        `)
        .eq('title', 'Solveway AI Usage Policy')
        .single();

    if (error || !dbData) {
        console.error('❌ Could not find policy document:', error);
        return;
    }

    const storedVectorRaw = dbData.eli_chunks[0].eli_embeddings[0].embedding;
    const targetVector = typeof storedVectorRaw === 'string' ? JSON.parse(storedVectorRaw) : storedVectorRaw;

    // 4. Test 1: use Stored Vector (Should work)
    console.log('\n4️⃣ Test 1: RPC with STORED vector...');
    const { data: rpcDataStored, error: rpcErrorStored } = await supabaseAdmin.rpc('find_similar_chunks', {
        query_embedding: targetVector,
        match_threshold: -100.0,
        match_count: 5
    });
    console.log(`   [Stored] Matches: ${rpcDataStored?.length || 0}`);

    // 5. Test 2: use Generated Vector (Direct)
    console.log('\n5️⃣ Test 2: RPC with GENERATED vector...');
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('find_similar_chunks', {
        query_embedding: queryVector,
        match_threshold: -100.0,
        match_count: 5
    });
    console.log(`   [Generated] Matches: ${rpcData?.length || 0}`);

    // 6. Test 6: Raw Debug Distance
    console.log('\n6️⃣ Test 6: RAW DISTANCE DEBUG...');
    let debugDistData = [];
    let debugError = null;
    try {
        const { data, error } = await supabaseAdmin.rpc('debug_vector_distance', {
            query_embedding: queryVector
        });
        if (data) debugDistData = data;
        if (error) debugError = error;
    } catch (e) { console.error('   Test 6 Exception:', e); }

    // Write results to file
    const fs = await import('fs');
    const output = `
    Diagnostic Results (Ultimate):
    Test 1 (Stored): ${rpcDataStored?.length || 0} matches
    Test 2 (Generated): ${rpcData?.length || 0} matches
    Test 6 (Raw Debug): ${debugDistData.length > 0 ? JSON.stringify(debugDistData[0]) : 'No data'}
    Test 6 Error: ${debugError ? JSON.stringify(debugError) : 'None'}
    
    Generated Vector Info:
    Length: ${queryVector.length}
    First 5: ${JSON.stringify(queryVector.slice(0, 5))}
    `;
    fs.writeFileSync('debug_output.txt', output);
    console.log('Done. Check debug_output.txt');
}

debugSimilarity().catch(console.error);
