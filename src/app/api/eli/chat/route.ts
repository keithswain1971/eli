import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { findRelevantChunks } from '@/lib/vector-store';
import OpenAI from 'openai';

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
    if (isCourseQuery && courseSources.length >= 2) {
        // Auto-generate carousel token from course sources
        const items = courseSources.slice(0, 3).map(course => ({
            title: course.title.replace(/\[Source:\s*/, '').replace(/\s*\(strapi_course\)\]/, '').trim(),
            description: course.content.substring(0, 150).replace(/\n/g, ' ').trim() + '...',
            url: course.url || 'https://solveway.co.uk'
        }));

        carouselInjection = `\n\n[UI_COMPONENT: ${JSON.stringify({ type: 'carousel', data: { items } })}]`;
        console.log('🎠 [Carousel] ✅ GENERATED TOKEN, length:', carouselInjection.length);
    } else {
        console.log('🎠 [Carousel] ❌ NOT generating. isCourseQuery:', isCourseQuery, ', sources:', courseSources.length);
    }


    // 4. System Prompt
    const systemPrompt = `You are Eli, Solveway's Lead AI Apprenticeship Consultant.

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

    // Debug: Check if carousel was injected into prompt
    if (carouselInjection) {
        console.log('🎠 [Carousel] ✅ Carousel injected into system prompt');
        console.log('🎠 [Carousel] Prompt includes instruction:', systemPrompt.includes('CRITICAL UI INSTRUCTION'));
    }



    // 5. Stream Response
    const result = await streamText({
        model: openai('gpt-4o'),
        system: systemPrompt,
        messages: messages,
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
                    has_carousel_generated: !!carouselInjection
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

