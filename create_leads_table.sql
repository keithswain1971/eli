create table if not exists eli_leads (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  name text,
  email text,
  phone text,
  intent text,
  source_url text,
  chat_session_id text
);

alter table eli_leads enable row level security;

create policy "Enable insert for all users" on eli_leads for insert
with check (true);

create policy "Enable select for service role only" on eli_leads for select
using (auth.role() = 'service_role');
