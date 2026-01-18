import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function testEndpoints() {
    const endpoints = [
        'route',
        'routes',
        'blog-post',
        'blog-posts',
        'programme',
        'programmes',
        'location',
        'locations',
        'entry-requirement-template',
        'entry-requirement-templates',
        'entry-requirements'
    ];

    console.log('Testing different endpoint variations...\n');

    for (const endpoint of endpoints) {
        const url = `${process.env.STRAPI_API_URL}/api/${endpoint}`;
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}` },
            });

            if (response.ok) {
                const json = await response.json();
                console.log(`✅ ${endpoint}: ${json.data?.length || 0} items`);
            } else {
                console.log(`❌ ${endpoint}: ${response.status} ${response.statusText}`);
            }
        } catch (error: any) {
            console.log(`❌ ${endpoint}: ${error.message}`);
        }
    }
}

testEndpoints().catch(console.error);
