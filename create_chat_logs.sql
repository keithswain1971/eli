create table if not exists eli_chat_logs (
    id uuid default gen_random_uuid() primary key,
    created_at timestamptz default now(),
    session_id text,
    user_message text,
    assistant_response text,
    metadata jsonb
);

alter table eli_chat_logs enable row level security;

-- Allow insert for all users (anon key needs this to log chat)
create policy "Enable insert for all users" on eli_chat_logs for insert
with check (true);

-- Allow select for service role only (admin dashboard uses service role or strict auth)
create policy "Enable select for service role only" on eli_chat_logs for select
using (auth.role() = 'service_role');

-- Use this if we want to allow public read (TEMPORARY for MVP Dashboard)
create policy "Enable read for all users" on eli_chat_logs for select
using (true);
