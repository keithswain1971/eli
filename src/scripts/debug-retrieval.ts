import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Direct client creation to bypass module issues
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRetrieval() {
    console.log('🔍 Checking chunks for "Assistant Accountant"...');

    // Search TEXT match as a proxy for retrieval
    const { data, error } = await supabase
        .from('eli_chunks')
        .select(`
            content,
            document:eli_documents!inner(url, title)
        `)
        .ilike('content', '%Assistant Accountant%')
        .limit(3);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`Found ${data.length} text matches.`);
    data.forEach((row: any, i) => {
        console.log(`\n--- Match ${i} ---`);
        console.log(`Title: ${row.document.title}`);
        console.log(`URL: ${row.document.url}`);
        console.log(`Snippet: ${row.content.slice(0, 100)}...`);
    });
}

debugRetrieval();
