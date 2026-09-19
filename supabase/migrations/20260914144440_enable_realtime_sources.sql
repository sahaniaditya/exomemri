-- Enable replication so Supabase Realtime can see row changes on sources
alter publication supabase_realtime add table public.sources;

-- Ensure RLS is enabled and scopes SELECT to the row's owner, which is
-- what Realtime's postgres_changes subscription checks against
alter table public.sources enable row level security;

create policy "sources_select_own"
on public.sources
for select
using (auth.uid() = user_id);