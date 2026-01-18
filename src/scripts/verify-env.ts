import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';

async function verify() {
    console.log('🔍 Verifying Environment Configuration...');

    const results = {
        supabase: { status: 'unknown', error: null },
        openai: { status: 'unknown', error: null },
        strapi: { status: 'unknown', error: null }
    };

    // 1. Check Supabase
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!url || !key) throw new Error('Missing Supabase Config');

        const supabase = createClient(url, key);
        // Just check we can make a request. List a system table or something public.
        const { error } = await supabase.from('eli.documents' as any).select('count', { count: 'exact', head: true });

        // If table doesn't exist, it might error, but connection is good if code is not network error.
        if (error && error.code === 'PGRST116') {
            results.supabase = { status: 'ok', error: 'Table not found but connection presumed ok' };
        } else if (error) {
            results.supabase = { status: 'failed', error: error.message };
        } else {
            results.supabase = { status: 'ok', error: null };
        }
    } catch (e: any) {
        results.supabase = { status: 'failed', error: e.message };
    }

    // 2. Check OpenAI
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('Missing OpenAI Key');

        const openai = new OpenAI({ apiKey });
        await openai.models.list();
        results.openai = { status: 'ok', error: null };
    } catch (e: any) {
        results.openai = { status: 'failed', error: e.message };
    }

    // 3. Check Strapi
    try {
        const strapiUrl = process.env.STRAPI_API_URL;
        const strapiToken = process.env.STRAPI_API_TOKEN;

        if (!strapiUrl) {
            results.strapi = { status: 'skipped', error: 'Missing STRAPI_API_URL' };
        } else {
            const res = await fetch(`${strapiUrl}/api/users`, {
                headers: { Authorization: `Bearer ${strapiToken}` }
            });

            if (res.status >= 200 && res.status < 500) {
                results.strapi = { status: 'ok', error: `Status ${res.status}` };
            } else {
                results.strapi = { status: 'failed', error: `Status ${res.status}` };
            }
        }
    } catch (e: any) {
        results.strapi = { status: 'failed', error: e.message };
    }

    fs.writeFileSync('verify_result.json', JSON.stringify(results, null, 2));
    console.log('Done writing verify_result.json');
}

verify();
