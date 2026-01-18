
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkContentColumn() {
    console.log('🔍 Checking Content Column specifically...');

    // Explicitly select 'content'
    const { data, error } = await supabase
        .from('eli_documents')
        .select('id, title, content')
        .eq('source_type', 'entry_requirement')
        .limit(1);

    if (error) {
        console.error('❌ Error selecting content:', JSON.stringify(error, null, 2));
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Success! Found content (truncated):');
        const c = data[0].content;
        console.log(c ? c.substring(0, 200) : 'NULL/UNDEFINED');
    } else {
        console.log('⚠️ No data found (or empty).');
    }
}

checkContentColumn();
