import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

async function diagnose() {
    console.log('Environment check:');
    console.log('STRAPI_API_URL:', process.env.STRAPI_API_URL);
    console.log('STRAPI_API_TOKEN:', process.env.STRAPI_API_TOKEN ? 'Set (length: ' + process.env.STRAPI_API_TOKEN.length + ')' : 'Not set');

    console.log('\nTesting fetch with detailed error...');
    const url = `${process.env.STRAPI_API_URL}/api/route?populate=*`;
    console.log('URL:', url);

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${process.env.STRAPI_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const text = await response.text();
            console.log('Response body:', text);
        } else {
            const data = await response.json();
            console.log('Success! Data:', JSON.stringify(data, null, 2).substring(0, 500));
        }
    } catch (error: any) {
        console.error('Fetch error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error cause:', error.cause);
        console.error('Full error:', error);
    }
}

diagnose().catch(console.error);
