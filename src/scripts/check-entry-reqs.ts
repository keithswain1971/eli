
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEntryReqs() {
    console.log('🔍 Checking Entry Requirements in DB...');

    const { data, error } = await supabase
        .from('eli_documents')
        .select('*')
        .eq('source_type', 'entry_requirement');

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('⚠️ No entry requirement documents found.');
        return;
    }

    console.log(`✅ Found ${data.length} documents.`);
    for (const doc of data) {
        console.log('---------------------------------------------------');
        console.log(`Keys: ${Object.keys(doc).join(', ')}`);
        console.log(`Title: ${doc.title}`);
        console.log(`Content Preview:\n${doc.content}`);
    }
}

checkEntryReqs();
