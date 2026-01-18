
import { fetchStrapi } from '../lib/strapi';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '.env.local') });

async function checkSkills() {
    console.log('🔍 Checking Skills Endpoint...');
    try {
        // Try plural 'skills' first
        console.log('Fetching skills?populate=*...');
        const response = await fetchStrapi('skills?populate=*');

        if (response.data && response.data.length > 0) {
            console.log(`✅ Found ${response.data.length} skills.`);
            const s1 = response.data[0];
            const attr = s1.attributes || s1;
            console.log('Sample Skill Keys:', Object.keys(attr));
            console.log('Sample Skill:', JSON.stringify(attr, null, 2));
        } else {
            console.log('⚠️ No skills found at /api/skills. Trying singular?');
            // Try singular 'skill' just in case? Or 'technologies'?
            // But screenshot said "api::skill.skill" which maps to "/api/skills".
        }
    } catch (e) {
        console.error('❌ Error fetching skills:', e);
    }
}

checkSkills();
