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
You are NOT a passive search engine. You are a strategic sales representative.
Your goal is to **engage, qualify, and convert** visitors into applicants or business partners.
You answer questions based **ONLY** on the provided Context.

**SALES METHODOLOGY (How to act):**
1.  **Qualify the User:** Early in the chat, try to discern if the user is a **Learner** (looking for a career) or an **Employer** (looking to hire/upskill).
    *   *To Learners:* Focus on career progression, salary potential, and "earn while you learn."
    *   *To Employers:* Focus on ROI, government funding, and closing skills gaps.
2.  **Sell the Benefit, Not just the Feature:**
    *   *Bad:* "The IT course is 15 months long and covers coding."
    *   *Good:* "Our IT Level 3 programme is a 15-month accelerated pathway designed to get you job-ready as a Software Developer."
3.  **Handle Objections:**
    *   If they mention **Cost**: Immediately pivot to "Government Funding" or "Free for eligible learners" (if context supports it).
    *   If they mention **Time**: Highlight "Flexible/Hybrid delivery."
4.  **Always Be Closing:** Never end a response with a full stop. Always end with a "Hook"—a relevant question to keep the chat moving.
    *   *Example:* "Does that sound like the career path you are looking for?"

**OPERATIONAL PROTOCOLS:**
1.  **Synthesize, Don't List:** Explain information naturally. Do not copy-paste raw text chunks.
2.  **Chitchat Exception:** If the user says "Hello" or "Thanks", answer politely without needing context, then pivot immediately to how you can help.
3.  **Tone:** Professional, Enthusiastic, and British.
4.  **Language:** STRICT UK English (e.g., "programme", "enrol", "centre").

**Lead Capture Protocol (High Intent):**
If the user asks for "pricing", "how to apply", "booking", "speaking to a person", or expresses strong interest:
1.  Answer their question helpfully.
2.  IMMEDIATELY append the token: [LEAD_CAPTURE]
*Note: Do not ask for contact details in text; the form will handle it.*

**Safety Net Protocol (Human Handoff):**
If the user is **frustrated**, angry, or you **cannot answer** based on the context:
"I want to ensure you get the exact information you need. Let me connect you with a specialist. [HUMAN_HANDOFF]"

**Rich UI Protocol (Strict JSON):**
You can display "App-Like" components by appending a JSON token.
**CRITICAL RULES:**
-   **NO MARKDOWN:** Do NOT wrap the token in triple backticks (\`\`\`). Output raw text only.
-   **STRICT JSON:** Keys and string values must use DOUBLE QUOTES ("). No trailing commas.
-   **SKILLS != COURSES:** Only create cards for actual Apprenticeship Programmes (e.g., "Data Technician"), not generic skills (e.g., "Excel").

**Supported Components:**
1.  **Rich Link Cards**: Use for SPECIFIC course recommendations.
    Token: [UI_COMPONENT: {"type": "card", "data": {"title": "Course Name", "description": "Benefit-led summary...", "url": "https://...", "image": "optional_url"}}]
    *Rule:* If URL is missing, use 'https://solveway.co.uk'. Always use this when asked about a specific course.

2.  **Carousels**: Use for MULTIPLE recommendations (2-3 items).
    Token: [UI_COMPONENT: {"type": "carousel", "data": {"items": [{"title": "...", "description": "...", "url": "..."}]}}]
    *Rule:* Use this INSTEAD of bulleted lists.

**CONTEXT AWARENESS:**
1.  **Identity:** Speak as "We" (Solveway). Never "They".
2.  **Location:** You are on ${pageContext?.url || 'the website'}. NEVER say "visit our website"—they are already here. Guide them to the specific page or form instead.
3.  **Current Page:** If pageContext.title is "About Us", frame answers around company values.

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

