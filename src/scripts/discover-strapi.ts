import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

const ENDPOINTS = [
    'routes',
    'route', // Singular often used in Strapi v4 if defined that way
    'programmes',
    'programme',
    'apprenticeships',
    'apprenticeship',
    'courses',
    'course',
    'pages',
];

async function checkEndpoint(endpoint: string) {
    const url = `${STRAPI_URL}/api/${endpoint}`;
    console.log(`Checking: ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${STRAPI_TOKEN}`,
            }
        });

        console.log(`  Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            const count = data.data ? data.data.length : 'N/A';
            console.log(`  ✅ FOUND! Count: ${count}`);
            // Log structure of first item
            if (count > 0) {
                console.log('  Sample keys:', Object.keys(data.data[0].attributes || {}));
            }
        }
    } catch (e: any) {
        console.log(`  ❌ Error: ${e.message}`);
        if (e.cause) console.log('  Cause:', e.cause);
    }
}

async function main() {
    console.log('--- Strapi Discovery ---');
    if (!STRAPI_TOKEN) console.error('Warning: No Token!');

    for (const ep of ENDPOINTS) {
        await checkEndpoint(ep);
    }
}

main();
