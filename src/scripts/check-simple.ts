import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function checkAll() {
    const { supabaseAdmin } = await import('../lib/supabase');

    try {
        const { data: docs, error: docsErr } = await supabaseAdmin
            .from('documents')
            .select('id, title, source_type')
            .schema('eli');

        if (docsErr) {
            console.error('Error:', docsErr.message);
            console.error('Details:', docsErr.details);
            console.error('Hint:', docsErr.hint);
        } else {
            console.log(`\n📄 Found ${docs?.length || 0} documents`);
            docs?.forEach(d => console.log(`   - [${d.source_type}] ${d.title}`));
        }
    } catch (error: any) {
        console.error('Catch error:', error.message);
    }
}

checkAll().catch(console.error);
