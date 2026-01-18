import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

import { fetchStrapi } from '../lib/strapi';

async function test() {
    const fs = await import('fs/promises');
    const output: string[] = [];

    const log = (msg: string) => {
        console.log(msg);
        output.push(msg);
    };

    log('Testing Strapi connection...');
    log('STRAPI_API_URL: ' + process.env.STRAPI_API_URL);
    log('STRAPI_API_TOKEN: ' + (process.env.STRAPI_API_TOKEN ? 'Set' : 'Not set'));

    try {
        log('\n1. Fetching routes...');
        const routes = await fetchStrapi('route?populate=*');
        log('Routes count: ' + (routes.data?.length || 0));
        if (routes.data?.[0]) {
            log('Sample route: ' + JSON.stringify({
                name: routes.data[0].attributes?.name,
                slug: routes.data[0].attributes?.slug
            }, null, 2));
        }
    } catch (error) {
        log('Routes error: ' + error);
    }

    try {
        log('\n2. Fetching blog posts...');
        const posts = await fetchStrapi('blog-post?populate=*');
        log('Blog posts count: ' + (posts.data?.length || 0));
        if (posts.data?.[0]) {
            log('Sample post: ' + JSON.stringify({
                title: posts.data[0].attributes?.title,
                slug: posts.data[0].attributes?.slug
            }, null, 2));
        }
    } catch (error) {
        log('Blog posts error: ' + error);
    }

    await fs.writeFile('strapi-test-output.txt', output.join('\n'));
    log('\n✅ Output saved to strapi-test-output.txt');
}

test().catch(console.error);
