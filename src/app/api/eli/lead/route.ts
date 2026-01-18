import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, email, phone, intent, source_url, chat_session_id } = body;

        const { data, error } = await supabaseAdmin
            .from('eli_leads')
            .insert([
                { name, email, phone, intent, source_url, chat_session_id }
            ] as any)
            .select();

        if (error) throw error;

        return Response.json({ success: true, lead: data[0] });
    } catch (error) {
        console.error('Lead save error:', error);
        return new Response('Error saving lead', { status: 500 });
    }
}
