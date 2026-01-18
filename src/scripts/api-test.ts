import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function test() {
    console.log('Testing Strapi API directly...\n');

    const url = `${process.env.STRAPI_API_URL}/api/route?populate=*`;
    console.log('URL:', url);
    console.log('Token:', process.env.STRAPI_API_TOKEN?.substring(0, 20) + '...\n');

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`,
            },
        });

        console.log('Status:', response.status);

        if (response.ok) {
            const json = await response.json();
            console.log('\nResponse structure:', {
                hasData: !!json.data,
                dataIsArray: Array.isArray(json.data),
                dataLength: json.data?.length || 0,
            });

            if (json.data?.length > 0) {
                console.log('\nFirst item:', JSON.stringify(json.data[0], null, 2).substring(0, 300));
            } else {
                console.log('\nNo data in response!');
                console.log('Full response:', JSON.stringify(json, null, 2));
            }
        } else {
            const text = await response.text();
            console.log('Error response:', text);
        }
    } catch (error: any) {
        console.error('Fetch error:', error.message);
    }
}

test().catch(console.error);
