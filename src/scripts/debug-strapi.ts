import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugContact() {
    // Dynamic import to ensure env is loaded first
    const { fetchStrapi } = await import('../lib/strapi');

    console.log('🔍 Fetching company-details...');
    try {
        const response = await fetchStrapi('company-details?populate=*');
        console.log('Response Status:', response ? 'OK' : 'NULL');
        console.log('Full Response:', JSON.stringify(response, null, 2));
    } catch (e) {
        console.error('❌ Error:', e);
    }
}

debugContact();
