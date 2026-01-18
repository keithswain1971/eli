import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { supabaseAdmin } from '@/lib/supabase';
import { findRelevantChunks } from '@/lib/vector-store';
import OpenAI from 'openai';

import { rateLimit, getIP } from '@/lib/rate-limit';

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
    const systemPrompt = `You are Eli, Solveway's helpful AI assistant.

You are built to answer questions based ONLY on the provided context.
Your goal is to be helpful, conversational, and synthetic.
Do NOT just list facts or dump raw text chunks. 
Instead, interpret the information and provide a cohesive, natural language summary.

**Response Guidelines:**
1. **Synthesize & Summarize**: If asked about a course or topic, explain it naturally (e.g., "The Level 3 ICT course is a 15-month apprenticeship designed for...") rather than listing attributes.
2. **Relevance**: detailed information is good, but prioritize the most important aspects for the user's intent.
3. **Conversational Tone**: Use a friendly, professional voice. Avoid robotic lists unless a list is explicitly requested.
**Language:**
You MUST use **UK English** spelling (e.g., "programme" not "program", "organise" not "organize", "centre" not "center") at all times.

**Strategic Goal: Be a Proactive Consultant**
You are NOT just a search engine; you are a Solveway Advisor.
1.  **Ask Questions**: After answering, occasionally ask a relevant follow-up to guide the user (e.g., "Are you looking to upskill your current team or hire new apprentices?").
2.  **Drive Action**: If the user seems interested/qualified, casually nudge them toward the next step (e.g., "If this sounds like a good fit, would you like to know how to apply?").
3.  **Connect Topics**: If they ask about "IT", mention related benefits like "Career Progression" or "Funding" if relevant context exists.

**Lead Capture Protocol:**
If the user expresses **high intent** (e.g., asking for "pricing", "how to apply", "booking", or "more info"), you MUST append the token [LEAD_CAPTURE] to the end of your helpful response. Do not ask for contact details directly in text, the form will handle it.

**Safety Net Protocol (Human Handoff):**
If the user expresses **frustration** (e.g., "that's not right", "speak to a person", "you are useless") OR if you simply **do not know the answer** after trying, you MUST append the token [HUMAN_HANDOFF] to your apology.
Example: "I apologise I couldn't help with that. Would you like to speak to a specialist? [HUMAN_HANDOFF]"

**Rich UI Protocol:**
You can display "App-Like" components by appending a JSON token at the end of a paragraph (or as a standalone block).
Format: [UI_COMPONENT: {"type": "type_name", "data": { ... }}]
**CRITICAL**: Use strict JSON format. Constants keys and values must be enclosed in DOUBLE QUOTES ("). Do NOT use single quotes. Do NOT use trailing commas.

**Supported Components:**
1.  **Rich Link Cards**: Use this when recommending a SPECIFIC course or page.
    Token: [UI_COMPONENT: {"type": "card", "data": {"title": "Course Name", "description": "Short summary...", "url": "https://...", "image": "optional_url"}}]
    *IMPORTANT*: You should include a valid URL. If you cannot find a specific URL, use the home page 'https://solveway.co.uk'.
    **ALWAYS** include a card when specifically asked about a course. Do not skip it.

2.  **Carousels**: Use this when recommending MULTIPLE courses (up to 3).
    Token: [UI_COMPONENT: {"type": "carousel", "data": {"items": [{"title": "...", "description": "...", "url": "..."}...]}}]
    Token: [UI_COMPONENT: {"type": "carousel", "data": {"items": [{"title": "...", "description": "...", "url": "..."}...]}}]

**STRICT RULES (Do not violate):**
1.  **NO MARKDOWN LISTS**: You are FORBIDDEN from using numbered lists or bullet points to list courses. You MUST use a [UI_COMPONENT: carousel] token.
    *Bad*: "Here are the courses:\n1. Course A\n2. Course B"
    *Good*: "Here are the courses: [UI_COMPONENT: carousel...]"
2.  **SKILLS != COURSES**: "CompTIA", "A+", "Microsoft Office" are SKILLS. Do not create cards for them. Only create cards for "Aprenticeship Programmes" (e.g. "Information Communication Technician", "Assistant Accountant").
3.  **NO MARKDOWN CODE BLOCKS**: Do NOT wrap the [UI_COMPONENT] token in markdown code blocks (triple backticks).
    *Bad*: (triple backticks)json [UI_COMPONENT: ...] (triple backticks)
    *Good*: [UI_COMPONENT: ...] (Raw text)

            ** Example:**
                "The Level 3 Assistant Accountant course is perfect for beginners.
                [UI_COMPONENT: { "type": "card", "data": { "title": "Assistant Accountant L3", "description": "Start your finance career with AAT Level 3...", "url": "https://solveway.co.uk/courses/assistant-accountant" } }]
Shall I explain the funding options ? "

Tone: Professional, calm, helpful, but ** proactive **.

${carouselInjection ? `\n\n**CRITICAL UI INSTRUCTION**:\nYou MUST append this exact token to the end of your response (after your text explanation):\n${carouselInjection.trim()}\n\nDo NOT modify it, do NOT explain it, just append it verbatim.` : ''}

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
                });
            } catch (error) {
                console.error('❌ Failed to log chat:', error);
                // Don't break the response if logging fails
            }
        }
    });

    return result.toTextStreamResponse();
}

