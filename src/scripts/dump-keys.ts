
import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function dumpKeys() {
    console.log('🔍 Dumping Strapi Keys...');
    const url = `${process.env.STRAPI_API_URL}/api/entry-requirement-templates?populate=*`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}` },
        });

        if (!response.ok) {
            console.error(`❌ Error ${response.status}: ${response.statusText}`);
            return;
        }

        const json = await response.json();
        const items = json.data || [];

        if (items.length > 0) {
            const first = items[0];
            const attr = first.attributes || first;
            console.log('🔑 Keys found in first item:');
            console.log(JSON.stringify(Object.keys(attr), null, 2));
            // console.log('📄 Full object dump:');
            // console.log(JSON.stringify(attr, null, 2));
        } else {
            console.log('⚠️ No items found.');
        }

    } catch (error) {
        console.error('❌ Fetch error:', error);
    }
}

dumpKeys();
