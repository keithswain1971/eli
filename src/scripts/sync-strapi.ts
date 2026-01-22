import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// --- CONFIG ---
const STRAPI_URL = process.env.STRAPI_API_URL || 'https://cms.solveway.co.uk';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// --- INIT CLIENTS ---
if (!STRAPI_TOKEN) console.error('❌ Missing STRAPI_API_TOKEN');
if (!OPENAI_KEY) console.error('❌ Missing OPENAI_API_KEY');
if (!SUPABASE_KEY) console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

// --- HELPER: FETCH STRAPI ---
async function fetchStrapi(endpoint: string) {
    const url = `${STRAPI_URL}/api/${endpoint}`;
    console.log(`🌐 Fetching: ${url}`);

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${STRAPI_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return await res.json();
    } catch (e: any) {
        console.error(`❌ Fetch Error (${endpoint}):`, e.message);
        return null;
    }
}

// --- HELPER: EMBED ---
async function generateEmbedding(text: string) {
    const res = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' ')
    });
    return res.data[0].embedding;
}

// --- MAIN SYNC LOGIC ---
async function main() {
    console.log('🚀 Starting Strapi -> Supabase Sync...');

    // 1. Fetch Data (Try 'routes' - likely where programmes live in this context)
    // Note: User mentioned "programmes from strapi", but 'routes' was used in test script.
    // We'll try fetching 'routes' which likely represent the detailed apprenticeship pages.
    let data = await fetchStrapi('routes?populate=*');

    // Fallback if 'routes' fails or empty, try 'apprenticeships'
    if (!data || !data.data || data.data.length === 0) {
        console.log('⚠️ No routes found, trying "apprenticeships"...');
        data = await fetchStrapi('apprenticeships?populate=*');
    }

    if (!data || !data.data || data.data.length === 0) {
        console.error('❌ No data found in Strapi. Aborting.');
        return;
    }

    const items = data.data;
    console.log(`📦 Found ${items.length} items to sync.`);

    // 2. Clear Old Data
    console.log('🧹 Clearing old Strapi data from Supabase...');
    const { error: deleteError } = await supabase
        .from('eli_documents')
        .delete()
        .eq('source_type', 'strapi_course');

    if (deleteError) {
        console.error('❌ Failed to clear old data:', deleteError);
        return;
    }

    // 3. Process & Insert
    for (const item of items) {
        console.log('  🔍 Inspecting item structure:', JSON.stringify(item, null, 2).substring(0, 100) + '...');

        // Handle Strapi v4 (attributes) vs potentially flattened or other formats
        const attr = item.attributes || item;

        if (!attr) {
            console.error('  ❌ Item has no attributes or data:', item);
            continue;
        }

        const title = attr.title || attr.name || attr.Title || attr.Name || 'Unknown Programme';
        const slug = attr.slug || 'unknown';
        const url = `https://solveway.co.uk/apprenticeships/${slug}`; // Approximate URL structure

        console.log(`🔄 Processing: ${title}`);

        // Construct Rich Context Text
        let content = `PROGRAMME: ${title}\n`;
        if (attr.level) content += `LEVEL: ${attr.level}\n`;
        if (attr.duration) content += `DURATION: ${attr.duration}\n`;
        if (attr.overview) content += `OVERVIEW: ${attr.overview}\n`;
        if (attr.funding) content += `FUNDING: ${attr.funding}\n`;

        // Add specific key info if available
        if (attr.typical_job_titles) content += `JOB ROLES: ${attr.typical_job_titles}\n`;

        // Generate Embedding
        const embedding = await generateEmbedding(content);

        // Insert or Update Document (Upsert)
        const { data: doc, error: docError } = await supabase
            .from('eli_documents')
            .upsert({
                title: title,
                url: url,
                source_type: 'strapi_course',
                source_slug: slug
            }, { onConflict: 'source_slug' })
            .select()
            .single();

        if (docError || !doc) {
            console.error('  ❌ Failed to upsert document:', docError);
            continue;
        }

        // Clean up old chunks for this document to avoid duplicates
        await supabase.from('eli_chunks').delete().eq('document_id', doc.id);

        // Insert Chunk
        const { data: chunk, error: chunkError } = await supabase
            .from('eli_chunks')
            .insert({
                document_id: doc.id,
                content: content,
                chunk_index: 0
            })
            .select()
            .single();

        if (chunkError || !chunk) {
            console.error('  ❌ Failed to insert chunk:', chunkError);
            continue;
        }

        // Clean up old embeddings for this chunk (though deleting chunk should cascade, safety first)
        // Note: new chunk ID means we just insert new embedding.

        // Insert Embedding
        const { error: embedError } = await supabase
            .from('eli_embeddings')
            .insert({
                chunk_id: chunk.id,
                embedding: embedding
            });

        if (embedError) {
            console.error('  ❌ Failed to insert embedding:', embedError);
        } else {
            console.log('  ✅ Synced.');
        }
    }

    console.log('🎉 Sync Complete!');
}

main().catch(console.error);
