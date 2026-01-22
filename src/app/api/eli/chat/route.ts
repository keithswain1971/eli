import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { findRelevantChunks } from '@/lib/vector-store';
import OpenAI from 'openai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types';
import { dashboardToolDefinitions, getAbsentLearners, getLearnerDetails } from '@/lib/tools/dashboard-tools';

import { rateLimit, getIP } from '@/lib/rate-limit';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    // 0. Rate Limiting Strategy
    const ip = getIP(req);
    const isAllowed = rateLimit(ip, { limit: 10, windowMs: 60 * 1000 }); // 10 requests per minute

    if (!isAllowed) {
        return new Response('Too many requests. Please slow down.', { status: 429 });
    }

    const { messages, surface, pageContext, sessionId } = await req.json();

    // AI SDK sends messages array, get the latest user message
    if (!messages || messages.length === 0) {
        return new Response('Messages are required', { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    const userMessage = latestMessage.content;

    // 1. Get or create Session ID (simplified for now - could use headers/cookies)
    let currentSessionId = null;

    // --- SECURITY & CONTEXT BOUNDARY ---
    const authHeader = req.headers.get('Authorization');
    const accessToken = authHeader?.replace('Bearer ', '');

    let supabaseClient = supabaseAdmin; // Default to admin for PUBLIC website (read-only vectors)
    let userProfile = null; // Store user details if authenticated

    // STRICT BOUNDARY: Dashboard Access Control
    if (surface === 'dashboard') {
        if (!accessToken) {
            console.error('⛔ [Security] Dashboard request rejected: No Access Token');
            return new Response('Unauthorized: Dashboard access requires authentication.', { status: 401 });
        }

        // Create USER-SCOPED Client (Inherits RLS)
        // This means Eli can ONLY see rows this user is allowed to see.
        /* 
           NOTE: Using createClient with access_token is the standard way to act *on behalf* of a user.
           However, since we are currently using supabaseAdmin everywhere, we'll simulate the user check 
           by verifying the token first using getUser().
        */
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);

        if (authError || !user) {
            console.error('⛔ [Security] Invalid Access Token:', authError);
            return new Response('Unauthorized: Invalid Token.', { status: 401 });
        }

        userProfile = user;
        console.log(`🛡️ [Security] Authenticated Staff Request: ${user.email} (${user.id})`);

        // FUTURE: In a real "Tool" scenario, we would pass this `accessToken` to the tool 
        // to make queries on the user's behalf.
    }
    // ------------------------------------


    // 2. Generate Embedding for RAG
    // We use the raw OpenAI client for embeddings
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddingResponse = await oai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userMessage.replace(/\n/g, ' ')
    });
    const rawEmbedding = embeddingResponse.data[0].embedding;
    // Sanitize vector to ensure plain array (fixes RPC issue)
    const embedding = JSON.parse(JSON.stringify(rawEmbedding));

    console.log('🔍 Generated embedding, length:', embedding.length);

    // 3. Retrieve Context
    const relevantChunks = await findRelevantChunks(embedding);

    console.log('   Found', relevantChunks.length, 'relevant chunks');
    if (relevantChunks.length > 0) {
        console.log('   First chunk title:', relevantChunks[0].title);
        console.log('   First chunk source_type:', relevantChunks[0].source_type);
    }


    // Format Context
    const contextString = relevantChunks.map(c =>
        `[Source: ${c.title} (${c.source_type})] ${c.content}`
    ).join('\n\n');

    // Smart Carousel Injection: Detect if query is about courses
    const isCourseQuery = /cours|apprentice|program|training|learning|study/i.test(userMessage);
    console.log('🎠 [Carousel] isCourseQuery:', isCourseQuery);

    const courseSources = relevantChunks.filter(c =>
        c.source_type === 'route' && c.title
    );
    console.log('🎠 [Carousel] courseSources.length:', courseSources.length);

    let carouselInjection = '';
    // Only inject Sales UI on the PUBLIC Website
    if (surface === 'website' && isCourseQuery && courseSources.length >= 2) {
        // Auto-generate carousel token from course sources
        const items = courseSources.slice(0, 3).map(course => ({
            title: course.title.replace(/\[Source:\s*/, '').replace(/\s*\(strapi_course\)\]/, '').trim(),
            description: course.content.substring(0, 150).replace(/\n/g, ' ').trim() + '...',
            url: course.url || 'https://solveway.co.uk'
        }));

        carouselInjection = `\n\n[UI_COMPONENT: ${JSON.stringify({ type: 'carousel', data: { items } })}]`;
        console.log('🎠 [Carousel] ✅ GENERATED TOKEN, length:', carouselInjection.length);
    } else {
        console.log('🎠 [Carousel] ❌ NOT generating. Surface:', surface);
    }


    // 4. System Prompt Selection based on Surface
    let systemPrompt = '';

    if (surface === 'dashboard') {
        // --- STAFF ASSISTANT PERSONA ---
        systemPrompt = `You are Eli, the Solveway Staff Assistant.
        
**YOUR USER:**
You are speaking to an authenticated Staff Member (${userProfile?.email}).
They are busy and need quick, accurate facts.
        
**CORE DIRECTIVE:**
1.  **Be Internal & Direct**: Do not "sell". Do not ask "qualifying questions".
2.  **Data First**: You have tools to query the LIVE database. USE THEM.
    - If asked "Who is absent?", call \`get_absent_learners\`.
    - If asked about a student, call \`get_learner_details\`.
    - Always provide a summary of the data returned by the tool.
3.  **Tone**: Professional, concise, helpful colleague.

**CONTEXT:**
${contextString}
`;

    } else {
        // --- PUBLIC SALESPERSON PERSONA ---
        systemPrompt = `You are Eli, Solveway's Lead AI Apprenticeship Consultant.

**CORE DIRECTIVE:**
You are a strategic salesperson, NOT a search engine. 
Your goal is to **diagnose needs** before offering solutions.
You answer questions based ONLY on the provided Context.

**THE "TRIAGE PROTOCOL" (Critical Rule):**
If the user asks a BROAD question (e.g., "What courses do you have?", "What do you offer?", "Show me apprenticeships"), you are **FORBIDDEN** from listing specific course titles immediately.
**Instead, you must:**
1.  **Categorise:** Briefly mention the *sectors* available (e.g., "We specialise in IT, Data, Finance, and Business...").
2.  **Qualify:** Ask a question to narrow their interest.
    *   *Bad Response:* (Lists 5 courses with descriptions...)
    *   *Good Response:* "We offer accelerated apprenticeships across three main sectors: **IT & Data**, **Finance**, and **Business**. Are you looking to get into a technical role, or something more finance-related?"

**RESPONSE GUIDELINES:**
1.  **Brevity is Key:** Keep text responses under 3 sentences. Long blocks of text kill conversion.
2.  **No Numbered Lists:** You are FORBIDDEN from using text-based numbered lists (1. 2. 3.) in the chat. Use a Carousel UI or ask a narrowing question instead.
3.  **Tone:** Professional, Enthusiastic, and British (UK spelling).
4.  **Identity:** Speak as "We" (Solveway).

**Lead Capture Protocol (High Intent):**
If the user asks for "pricing", "how to apply", "booking", or expresses strong interest:
1.  Answer their question helpfully.
2.  IMMEDIATELY append the token: [LEAD_CAPTURE]

**Safety Net Protocol (Human Handoff):**
If the user is frustrated or you cannot answer based on context:
"I want to ensure you get the exact information you need. Let me connect you with a specialist. [HUMAN_HANDOFF]"

**Rich UI Protocol (Strict JSON):**
You can display "App-Like" components by appending a JSON token.
**CRITICAL:** Do NOT wrap tokens in triple backticks (\`\`\`). Output raw text.
**CRITICAL:** Keys and values must use DOUBLE QUOTES (").

**Supported Components:**
1.  **Rich Link Cards**: Use for SPECIFIC course recommendations (1 item).
    Token: [UI_COMPONENT: {"type": "card", "data": {"title": "Course Name", "description": "Benefit-led summary...", "url": "https://...", "image": "optional_url"}}]
    *Rule:* If URL is missing, use 'https://solveway.co.uk'.

2.  **Carousels**: Use this when recommending MULTIPLE courses (up to 3) **AFTER** the user has selected a category.
    Token: [UI_COMPONENT: {"type": "carousel", "data": {"items": [{"title": "...", "description": "...", "url": "..."}]}}]

${carouselInjection ? `\n\n**INJECTED UI INSTRUCTION**:\nYour response MUST end with this exact token:\n${carouselInjection.trim()}\n\nDo NOT modify it.` : ''}

        Context:
${contextString}

Current User Surface: ${surface || 'website'}
Current Page: ${pageContext?.title || 'Unknown'} (${pageContext?.url || 'Unknown'})
    `;
    }

    // Debug: Check if carousel was injected into prompt
    if (carouselInjection) {
        console.log('🎠 [Carousel] ✅ Carousel injected into system prompt');
        console.log('🎠 [Carousel] Prompt includes instruction:', systemPrompt.includes('CRITICAL UI INSTRUCTION'));
    }

    // Define Tools Object for streamText (if dashboard)
    const tools = surface === 'dashboard' ? {
        get_absent_learners: tool({
            description: dashboardToolDefinitions.get_absent_learners.description,
            parameters: z.object({
                date_string: z.string().describe('Date to check YYYY-MM-DD (or empty for today)')
            }),
            execute: async (args: any) => {
                const { date_string } = args;
                console.log('🛠️ [Tool] Executing get_absent_learners...');
                // Use the USER-SCOPED client (userProfile must be valid here)
                const userClient = createClient<Database>(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        global: { headers: { Authorization: `Bearer ${accessToken}` } },
                        auth: { persistSession: false }
                    }
                );
                return await getAbsentLearners(userClient, date_string);
            }
        }),
        get_learner_details: tool({
            description: dashboardToolDefinitions.get_learner_details.description,
            parameters: z.object({
                search_term: z.string().describe('Name or ULN of learner')
            }),
            execute: async (args: any) => {
                const { search_term } = args;
                console.log('🛠️ [Tool] Executing get_learner_details...');
                const userClient = createClient<Database>(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        global: { headers: { Authorization: `Bearer ${accessToken}` } },
                        auth: { persistSession: false }
                    }
                );
                return await getLearnerDetails(userClient, search_term);
            }
        })
    } : {};


    // 5. Stream Response
    const result = await streamText({
        model: openai('gpt-4o'),
        system: systemPrompt,
        messages: messages,
        tools: tools as any,
        maxSteps: 5,
        onFinish: async (result) => {
            // Log interaction to Supabase (Analytics)
            try {
                // Get user message from context or last message
                const lastUserMessage = messages.slice(-1)[0]?.content || 'Unknown';

                const metadata = {
                    surface: surface || 'website',
                    page: pageContext?.url || 'unknown',
                    is_course_query: isCourseQuery,
                    sources_found: courseSources.length,
                    generated_tokens: (result.usage as any).completionTokens || 0,
                    has_carousel_generated: !!carouselInjection,
                    user_id: userProfile?.id || null // Log the staff ID if available
                };

                await supabaseAdmin.from('eli_chat_logs').insert({
                    session_id: sessionId || 'anon_session',
                    user_message: lastUserMessage,
                    assistant_response: result.text,
                    metadata: metadata
                } as any);
            } catch (error) {
                console.error('❌ Failed to log chat:', error);
                // Don't break the response if logging fails
            }
        }
    });

    return result.toTextStreamResponse();
}
