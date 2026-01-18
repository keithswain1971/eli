
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkChunks() {
    console.log('🔍 Checking latest chunks...');

    // eli_chunks might have content, embedding, document_id
    const { data: chunks, error } = await supabase
        .from('eli_chunks')
        .select('content')
        .ilike('content', '%Safeguarding:%')
        .limit(5);

    // Also check for "Career Progression"
    const { data: cpChunks } = await supabase
        .from('eli_chunks')
        .select('content')
        .ilike('content', '%Career Progression:%')
        .limit(3);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (chunks && chunks.length > 0) {
        console.log(`✅ Found ${chunks.length} chunks with "Safeguarding:".`);
        chunks.forEach((c, i) => {
            console.log(`\n--- Chunk ${i} (Safeguarding) ---`);
            console.log(c.content.substring(0, 300));
        });
    } else {
        console.log('⚠️ No chunks found with "Safeguarding:"');
    }

    if (cpChunks && cpChunks.length > 0) {
        console.log(`✅ Found ${cpChunks.length} chunks with "Career Progression:".`);
        cpChunks.forEach((c, i) => {
            console.log(`\n--- Chunk ${i} (CP) ---`);
            console.log(c.content.substring(0, 300));
        });
    }
}

checkChunks();
