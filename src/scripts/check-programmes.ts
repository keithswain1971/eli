
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProgrammes() {
    console.log('🔍 Checking Programmes in DB...');

    // Check eli_documents for filtered subset
    const { data, error } = await supabase
        .from('eli_documents')
        .select('*') // 'content' might be missing from select * if not explicit? Let's try select * first as I think I added column.
        .eq('source_type', 'programme')
        .limit(3);

    if (error) {
        console.error('❌ Error selecting programmes:', JSON.stringify(error, null, 2));
        return;
    }

    if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} programmes.`);
        for (const doc of data) {
            console.log('---------------------------------------------------');
            console.log(`Title: ${doc.title}`);
            console.log(`Content Preview:`);
            // Explicitly fetch content if it's missing from object (Supabase quirk?)
            if (doc.content === undefined) {
                const { data: contentData } = await supabase.from('eli_documents').select('content').eq('id', doc.id).single();
                console.log(contentData?.content?.substring(0, 500) || 'STILL UNDEFINED');
            } else {
                console.log(doc.content.substring(0, 500));
            }
        }
    } else {
        console.log('⚠️ No programmes found.');
    }
}

checkProgrammes();
