import { supabaseAdmin } from '@/lib/supabase';
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    createdAt?: Date;
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return new Response('Missing sessionId', { status: 400 });
    }

    try {
        // Fetch logs for this session
        const { data: logs, error } = await supabaseAdmin
            .from('eli_chat_logs')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Transform logs back into AI SDK Message format
        const messages: Message[] = [];

        logs?.forEach((log: any) => {
            // Reconstruct User message
            if (log.user_message) {
                messages.push({
                    id: log.id + '-user',
                    role: 'user',
                    content: log.user_message,
                    createdAt: new Date(log.created_at)
                });
            }
            // Reconstruct Assistant message
            if (log.assistant_response) {
                messages.push({
                    id: log.id + '-assistant',
                    role: 'assistant',
                    content: log.assistant_response,
                    createdAt: new Date(log.created_at) // Approximate time match
                });
            }
        });

        return Response.json(messages);

    } catch (error) {
        console.error('Failed to fetch history:', error);
        return new Response('Failed to fetch history', { status: 500 });
    }
}
