import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function check() {
    const { supabaseAdmin } = await import('../lib/supabase');

    const { data: docs, error } = await supabaseAdmin
        .schema('eli')
        .from('documents')
        .select('id, title, source_type');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log(`\n📊 Found ${docs?.length || 0} documents in database:\n`);
        docs?.forEach(doc => {
            console.log(`  - [${doc.source_type}] ${doc.title}`);
        });
    }
}

check().catch(console.error);
