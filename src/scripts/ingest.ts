import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });
console.log('Env loaded:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Yes' : 'No');


// import { supabaseAdmin } from '../lib/supabase'; // Moved to dynamic import
// import { fetchStrapi } from '../lib/strapi';
import OpenAI from 'openai';

// This script is intended to be run via `npx tsx src/scripts/ingest.ts`

// Initialize OpenAI for embeddings
// We need to initialize this *after* config too if it uses process.env inline, but here it uses it in constructor.
// Let's delay openai init too or just assume it is fine if we init it later or passing key explicitly.
// It is const openai = new OpenAI... which happens at top level. Top level code runs after imports. 
// If imports are hoisted, config runs *after* imports? No.
// In TS/ESM: imports are evaluated first.
// So config() at top level runs *after* imports are linked.
// We must move dependencies that use env vars immediately (like supabaseInit) to be imported *after* config is called.

let openai: OpenAI;


async function generateEmbedding(text: string) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, ' '),
    });
    return response.data[0].embedding;
}

// Simple text splitter
function splitIntoChunks(text: string, maxTokens = 1000): string[] {
    // Rough estimation: 1 token ~= 4 chars
    const chunkSize = maxTokens * 4;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
}

function extractText(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(block => {
            if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'list-item') {
                return block.children?.map((child: any) => child.text).join('') || '';
            }
            // Handle lists
            if (block.type === 'list') {
                return block.children?.map((item: any) => `- ${item.children?.map((c: any) => c.text).join('')}`).join('\n') || '';
            }
            return '';
        }).join('\n');
    }
    return JSON.stringify(content);
}

async function ingest() {
    console.log('🚀 Starting Strapi content ingestion...');

    const { supabaseAdmin } = await import('../lib/supabase');
    const { fetchStrapi } = await import('../lib/strapi');

    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ Missing OPENAI_API_KEY');
        return;
    }

    const documents: Array<{
        source_type: string;
        source_slug: string;
        title: string;
        url: string;
        content: string;
    }> = [];

    // Clear existing data first
    console.log('🧹 Clearing existing data...');
    // We deleting chunks, which cascades to embeddings. Documents deletion cascades to chunks.
    const { error: deleteError } = await supabaseAdmin.from('eli_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    if (deleteError) console.error('❌ Error clearing documents:', deleteError);
    else console.log('✅ Cleared old documents');

    // Fetch Blog Posts from Strapi
    try {
        console.log('📝 Fetching blog posts from Strapi...');
        const blogResponse = await fetchStrapi('blog-posts?populate=*');
        const posts = blogResponse.data || [];
        console.log('DEBUG: First post:', posts[0] ? JSON.stringify(posts[0]).substring(0, 100) : 'None');

        for (const post of posts) {
            // Handle both Strapi v4 (attributes) and transformed/v5 (flat) structures
            const attr = post.attributes || post;

            documents.push({
                source_type: 'blog',
                source_slug: attr.slug || `post-${post.id}`,
                title: attr.title || 'Untitled Post',
                url: `/blog/${attr.slug || post.id}`,
                content: `
                    Title: ${attr.title || ''}
                    ${attr.excerpt ? `Excerpt: ${attr.excerpt}` : ''}
                    ${attr.content ? `\n\n${attr.content}` : ''}
                    ${attr.authors?.data?.length ? `Authors: ${attr.authors.data.map((a: any) => (a.attributes || a)?.name).join(', ')}` : ''}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${posts.length} blog posts`);
    } catch (error) {
        console.error('❌ Error fetching blog posts:', error);
    }

    // Fetch Routes from Strapi
    try {
        console.log('🛤️  Fetching routes from Strapi...');
        const routesResponse = await fetchStrapi('routes?populate=*');
        const routes = routesResponse.data || [];

        for (const route of routes) {
            const attr = route.attributes || route;
            const introText = extractText(attr.intro);

            documents.push({
                source_type: 'route',
                source_slug: attr.slug || `route-${route.id}`,
                title: attr.name || 'Untitled Route',
                url: `/routes/${attr.slug || route.id}`,
                content: `
                    Route Name: ${attr.name || ''}
                    Introduction:
                    ${introText}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${routes.length} routes`);
    } catch (error) {
        console.error('❌ Error fetching routes:', error);
    }

    // Fetch Programmes from Strapi
    try {
        console.log('🎓 Fetching programmes from Strapi...');
        // Deep populate attempts failed. Fallback to wildcards or simpler population.
        // Try populate=* first.
        const progEndpoint = 'programmes?populate=*';
        const progResponse = await fetchStrapi(progEndpoint);
        if (progResponse.data && progResponse.data.length > 0) {
            const p1 = progResponse.data[0];
            const a1 = p1.attributes || p1;
            console.log('DEBUG: Programme Keys:', Object.keys(a1));
            console.log('DEBUG: Entry Req Temp:', JSON.stringify(a1.entry_requirement_template || 'MISSING'));
        }
        const programmes = progResponse.data || [];
        console.log(`DEBUG: Found ${programmes.length} programmes`);

        for (const prog of programmes) {
            const attr = prog.attributes || prog;
            console.log(`DEBUG: Processing ${attr.title || attr.name}`);

            const startDateText = attr.intakeRule === 'LAST_WEDNESDAY_MONTHLY' ? 'Monthly (Last Wednesday of each month)' :
                attr.intakeRule === 'CUSTOM_DATES' && attr.customIntakeDates ? attr.customIntakeDates.map((d: any) => d.date).join(', ') :
                    attr.intakeRule === 'LAST_WEDNESDAY_EXCEPT_DECEMBER_FIRST_WEEKDAY_8_TO_12' ? 'Last Wednesday of month (except December)' : '';

            // Entry Requirements (Denormalized)
            let entryReqsText = '';
            if (attr.entry_requirement_template?.data) {
                const ert = attr.entry_requirement_template.data.attributes || attr.entry_requirement_template.data;
                if (ert.oreRequirements) entryReqsText = extractText(ert.oreRequirements);
            }

            // Block Fields
            const overviewText = extractText(attr.overview);
            const wylText = extractText(attr.whatYoullLearn);
            const assessmentText = extractText(attr.assessmentAndEPA);
            const careerText = extractText(attr.careerProgression);
            const employerBenefitsText = extractText(attr.employerBenefits);
            const learnerBenefitsText = extractText(attr.learnerBenefits);

            documents.push({
                source_type: 'programme',
                source_slug: attr.slug || `prog-${prog.id}`,
                title: attr.title || attr.name || 'Untitled Programme',
                url: `/programmes/${attr.slug || prog.id}`,
                content: `
                    Programme: ${attr.title || attr.name || ''}
                    Short Summary: ${attr.shortSummary || ''}
                    Level: ${attr.level || ''}
                    Duration: ${attr.durationMonths ? `${attr.durationMonths} months` : ''}
                    Delivery Model: ${attr.deliveryModel || ''}
                    Start Dates: ${startDateText}
                    
                    Overview:
                    ${overviewText}
                    
                    What You'll Learn:
                    ${wylText}
                    
                    Assessment & EPA:
                    ${assessmentText}
                    
                    Career Progression:
                    ${careerText}
                    
                    Benefits for Learners:
                    ${learnerBenefitsText}
                    
                    Benefits for Employers:
                    ${employerBenefitsText}
                    
                    Entry Requirements:
                    ${entryReqsText}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${programmes.length} programmes`);
    } catch (error) {
        console.error('❌ Error fetching programmes:', error);
    }

    // Fetch Entry Requirement Templates from Strapi
    try {
        console.log('📋 Fetching entry requirements from Strapi...');
        const reqResponse = await fetchStrapi('entry-requirement-templates?populate=*');
        const requirements = reqResponse.data || [];

        for (const req of requirements) {
            const attr = req.attributes || req;

            documents.push({
                source_type: 'entry_requirement',
                source_slug: attr.slug || `req-${req.id}`,
                title: attr.name || attr.title || 'Entry Requirements',
                url: `/requirements/${attr.slug || req.id}`,
                content: `
                    Requirement Template: ${attr.name || attr.title || ''}
                    ${attr.description ? `Description: ${attr.description}` : ''}
                    ${attr.content ? `Content: ${attr.content}` : ''}
                    ${attr.requirements ? `Requirements: ${extractText(attr.requirements)}` : ''}
                    ${attr.details ? `Details: ${extractText(attr.details)}` : ''}
                    ${attr.coreRequirements ? `Core Requirements: ${extractText(attr.coreRequirements)}` : ''}
                    ${attr.oreRequirements ? `Requirements: ${extractText(attr.oreRequirements)}` : ''}
                    ${attr.oneRequirements ? `Requirements: ${extractText(attr.oneRequirements)}` : ''}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${requirements.length} entry requirements`);
    } catch (error) {
        console.error('❌ Error fetching entry requirements:', error);
    }

    // Fetch Locations from Strapi
    try {
        console.log('📍 Fetching locations from Strapi...');
        const locResponse = await fetchStrapi('locations?populate=*');
        const locations = locResponse.data || [];

        for (const loc of locations) {
            const attr = loc.attributes || loc;
            const localCopyText = extractText(attr.uniqueLocalCopy);

            documents.push({
                source_type: 'location',
                source_slug: attr.slug || `loc-${loc.id}`,
                title: attr.name || 'Untitled Location',
                url: `/locations/${attr.slug || loc.id}`,
                content: `
                    Location: ${attr.name || ''}
                    Region: ${attr.region || ''}
                    HQ: ${attr.isHQ ? 'Yes' : 'No'}
                    
                    Local Information:
                    ${localCopyText}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${locations.length} locations`);
    } catch (error) {
        console.error('❌ Error fetching locations:', error);
    }

    // Fetch Skills from Strapi
    try {
        console.log('🛠️ Fetching skills from Strapi...');
        const skillsResponse = await fetchStrapi('skills?populate=*');
        const skills = skillsResponse.data || [];

        for (const skill of skills) {
            const attr = skill.attributes || skill;
            const introText = extractText(attr.intro);

            documents.push({
                source_type: 'skill',
                source_slug: attr.slug || `skill-${skill.id}`,
                title: attr.name || 'Untitled Skill',
                url: `/skills/${attr.slug || skill.id}`,
                content: `
                    Skill: ${attr.name || ''}
                    Introduction:
                    ${introText}
                    ${attr.Seo?.metaDescription ? `Description: ${attr.Seo.metaDescription}` : ''}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${skills.length} skills`);
    } catch (error) {
        console.error('❌ Error fetching skills:', error);
    }

    // Fetch Clients
    try {
        console.log('🏢 Fetching clients from Strapi...');
        const clientsResponse = await fetchStrapi('clients?populate=*');
        const clients = clientsResponse.data || [];
        for (const c of clients) {
            const attr = c.attributes || c;
            if (!attr.active) continue;
            documents.push({
                source_type: 'client',
                source_slug: `client-${c.id}`,
                title: attr.name || 'Untitled Client',
                url: attr.website || `/clients/${c.id}`,
                content: `Client: ${attr.name || ''}\nWebsite: ${attr.website || ''}`.trim()
            });
        }
        console.log(`✅ Fetched ${clients.length} clients`);
    } catch (error) {
        console.error('❌ Error fetching clients:', error);
    }

    // Fetch Company Details
    try {
        console.log('ℹ️ Fetching company details from Strapi...');
        const companyResponse = await fetchStrapi('company-details?populate=*');
        const companyDetails = companyResponse.data || []; // Usually singular type but Strapi treats as collection sometimes? User schema said Collection.
        for (const cd of companyDetails) {
            const attr = cd.attributes || cd;
            documents.push({
                source_type: 'company-detail',
                source_slug: `company-${cd.id}`,
                title: attr.companyName || 'Company Details',
                url: attr.website || '/',
                content: `
                    Company: ${attr.companyName || ''}
                    Address: ${attr.addressLine1}, ${attr.addressLine2 || ''}, ${attr.townCity}, ${attr.county}, ${attr.postcode}
                    Email: ${attr.email}
                    Phone: ${attr.phone}
                    Website: ${attr.website}
                    Tagline: ${attr.footerTagline}
                `.trim()
            });
        }
        console.log(`✅ Fetched ${companyDetails.length} company details`);
    } catch (error) {
        console.error('❌ Error fetching company details:', error);
    }

    // Fetch Safeguarding
    try {
        console.log('🛡️ Fetching safeguarding info from Strapi...');
        const sgPageResponse = await fetchStrapi('safeguarding-pages?populate=*');
        const sgPages = sgPageResponse.data || [];
        for (const sg of sgPages) {
            const attr = sg.attributes || sg;
            const intro = extractText(attr.intro);
            const resources = attr.supportResources?.map((r: any) => `${r.title}: ${r.description} (${r.link})`).join('\n') || '';

            documents.push({
                source_type: 'safeguarding',
                source_slug: `safeguarding-page-${sg.id}`,
                title: attr.heroTitle || 'Safeguarding',
                url: '/safeguarding',
                content: `
                    Safeguarding: ${attr.heroTitle}
                    Introduction:
                    ${intro}
                    
                    Support Resources:
                    ${resources}
                `.trim()
            });
        }

        const sgTeamResponse = await fetchStrapi('safeguarding-team-members?populate=*');
        const sgTeam = sgTeamResponse.data || [];
        for (const member of sgTeam) {
            const attr = member.attributes || member;
            if (!attr.active) continue;
            documents.push({
                source_type: 'safeguarding-team',
                source_slug: `sg-member-${member.id}`,
                title: attr.name || 'Safeguarding Officer',
                url: '/safeguarding',
                content: `
                    Safeguarding Team Member: ${attr.name}
                    Role: ${attr.role}
                    Email: ${attr.email}
                    Phone: ${attr.phone}
                `.trim()
            });
        }
        console.log(`✅ Fetched Safeguarding content`);
    } catch (error) {
        console.error('❌ Error fetching safeguarding:', error);
    }

    // Add the sample policy document too
    documents.push({
        source_type: 'policy',
        source_slug: 'solveway-ai-policy',
        title: 'Solveway AI Usage Policy',
        url: '/policies/ai-usage',
        content: `
            1. Purpose
            This policy outlines the acceptable use of Artificial Intelligence(AI) tools at Solveway to ensure data security, privacy, and ethical standards.
            
            2. Approved Tools
            - Eli Assistant(Internal)
            - OpenAI ChatGPT(Enterprise License only)
            - GitHub Copilot(Engineering Team)
            
            3. Data Privacy
            Do not input Personally Identifiable Information(PII) or sensitive learner data into public AI models. 
            All confidential data must remain within Solveway's secured environment.
            
            4. Code Generation
            AI - generated code must be reviewed by a human peer before deployment. 
            Developers are responsible for the security and functionality of any AI - assisted code.
        `
    });

    console.log(`\n📦 Processing ${documents.length} total documents...`);

    for (const doc of documents) {
        console.log(`\n📄 Processing: ${doc.title} (${doc.source_type})`);

        // 1. Insert Document
        const { data: docRecord, error: docError } = await supabaseAdmin
            .from('eli_documents')
            .insert({
                source_type: doc.source_type,
                source_slug: doc.source_slug,
                title: doc.title,
                url: doc.url
                // content: doc.content // Column missing in DB, skipping
            })
            .select()
            .single();

        if (docError) {
            console.error('❌ Error inserting doc:', JSON.stringify(docError, null, 2));
            console.error('   Error message:', docError.message);
            console.error('   Error details:', docError.details);
            console.error('   Error hint:', docError.hint);
            console.error('   Error code:', docError.code);
            continue;
        }

        console.log(`   ✅ Inserted document: ${docRecord.id} `);

        // 2. Chunk and Embed
        const chunks = splitIntoChunks(doc.content);
        console.log(`   📑 Creating ${chunks.length} chunks...`);

        for (let i = 0; i < chunks.length; i++) {
            const chunkText = chunks[i];
            const embedding = await generateEmbedding(chunkText);

            // 3. Insert Chunk
            const { data: chunkRecord, error: chunkError } = await supabaseAdmin
                .from('eli_chunks')
                .insert({
                    document_id: docRecord.id,
                    content: chunkText,
                    chunk_index: i
                })
                .select()
                .single();

            if (chunkError) {
                console.error('❌ Error inserting chunk:', chunkError);
                continue;
            }

            // 4. Insert Embedding - store as array
            const { error: embedError } = await supabaseAdmin
                .from('eli_embeddings')
                .insert({
                    chunk_id: chunkRecord.id,
                    embedding: embedding  // Pass array directly
                });

            if (embedError) console.error('❌ Error inserting embedding:', embedError);
        }
        console.log(`   ✅ Completed ${doc.title} `);
    }

    console.log('\n🎉 Ingestion complete! Eli can now answer questions about:');
    console.log('   - Blog posts');
    console.log('   - Routes and apprenticeships');
    console.log('   - Company policies');
}

ingest().catch(console.error);
