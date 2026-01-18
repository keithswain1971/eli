import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function testWrite() {
    console.log('🧪 Testing direct Supabase write...\n');

    const { supabaseAdmin } = await import('../lib/supabase');

    // Test insert
    const testDoc = {
        source_type: 'test',
        source_slug: `test-${Date.now()}`,
        title: 'Test Document',
        url: '/test'
    };

    console.log('Attempting to insert:', testDoc);

    const { data, error } = await supabaseAdmin
        .schema('eli')
        .from('documents')
        .insert(testDoc)
        .select();

    if (error) {
        console.error('❌ Insert failed:', error);
    } else {
        console.log('✅ Insert successful!', data);

        // Clean up - delete the test document
        await supabaseAdmin
            .schema('eli')
            .from('documents')
            .delete()
            .eq('id', data[0].id);
        console.log('🧹 Cleaned up test document');
    }
}

testWrite().catch(console.error);
