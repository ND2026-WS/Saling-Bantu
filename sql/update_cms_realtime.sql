-- ============================================================
-- SALING BANTU — PEMBARUAN DATABASE (untuk database yang SUDAH
-- pernah menjalankan supabase_schema.sql versi sebelumnya)
-- Fitur baru: CMS "Isi Website" + role pengelola + Realtime.
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel seluruh isi file ini -> Run.
-- (Database baru tidak butuh file ini; cukup supabase_schema.sql)
-- ============================================================

-- ============================================================
-- BAGIAN 19 — CMS ISI WEBSITE + ROLE PENGELOLA + REALTIME
-- Menjalankan admin dapat mengedit seluruh teks publik website
-- dari Panel Admin -> Isi Website, dan dashboard Realtime
-- menerima pembaruan instan via Supabase Realtime.
-- ============================================================

-- 19a. Role tambahan "pengelola" (setara admin untuk mengelola konten)
alter type public.app_role add value if not exists 'pengelola';

-- 19b. Helper: admin ATAU pengelola yang aktif
create or replace function public.is_pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin','pengelola') and is_active
  );
$$;

-- 19c. Tabel site_content (key-value teks publik website)
create table if not exists public.site_content (
  key        text primary key,
  value      text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists p_site_content_read on public.site_content;
create policy p_site_content_read on public.site_content
  for select to anon, authenticated using (true);
drop policy if exists p_site_content_write on public.site_content;
create policy p_site_content_write on public.site_content
  for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- 19d. Realtime: ikutkan tabel utama ke publication supabase_realtime
do $$ begin
  alter publication supabase_realtime add table public.assistance_requests;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.donations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.audit_logs;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.assistance_distributions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.site_content;
exception when duplicate_object then null; when undefined_object then null; end $$;
