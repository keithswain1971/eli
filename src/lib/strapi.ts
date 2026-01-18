const STRAPI_URL = process.env.STRAPI_API_URL || 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

export async function fetchStrapi(endpoint: string) {
    if (!STRAPI_TOKEN) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('STRAPI_API_TOKEN is missing. Calls to Strapi will likely fail.');
        }
    }

    const url = `${STRAPI_URL}/api/${endpoint}`;
    console.log(`Fetching Strapi: ${url}`);

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${STRAPI_TOKEN}`,
            'Content-Type': 'application/json',
        },
        cache: 'no-store'
    });

    if (!res.ok) {
        throw new Error(`Strapi error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data;
}
