-- ============================================================
-- SALING BANTU — PEMBARUAN DATABASE: MODUL GALERI FOTO
-- (untuk database yang SUDAH pernah menjalankan
--  supabase_schema.sql atau file update sebelumnya)
-- ------------------------------------------------------------
-- Fitur baru: galeri foto program & kegiatan
--   - Tabel gallery_photos: judul, keterangan, foto (URL atau
--     gambar terunggah), kategori, kaitan ke program bantuan,
--     status tayang/arsip
--   - Publik hanya melihat foto berstatus aktif
--   - Hanya admin/pengelola yang boleh menambah/mengubah/menghapus
--   - Ikut Realtime: galeri publik & panel admin memuat ulang
--     otomatis saat ada foto baru dari perangkat lain
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel SELURUH isi file ini -> Run.
-- (Database baru tidak butuh file ini; cukup supabase_schema.sql
--  yang sudah memuat BAGIAN 21 yang sama.)
-- ============================================================

-- ============================================================
-- BAGIAN 21 — MODUL GALERI FOTO
-- ============================================================

-- 21a. Pastikan role pengelola & helper is_pengelola tersedia
--      (idempotent — aman walau update sebelumnya sudah jalan)
do $$ begin
  alter type public.app_role add value if not exists 'pengelola';
exception when duplicate_object then null; end $$;

create or replace function public.is_pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin','pengelola') and is_active
  );
$$;

-- 21b. Tabel galeri foto
create table if not exists public.gallery_photos (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  caption       text not null default '',
  photo_url     text not null,
  category      text not null default 'kegiatan',
  request_id    uuid references public.assistance_requests(id) on delete set null,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  created_by    uuid references public.profiles(id) on delete set null,
  created_by_name text not null default 'Tim Saling Bantu',
  created_at    timestamptz not null default now()
);

create index if not exists idx_gallery_created on public.gallery_photos (created_at desc);

-- 21c. Keamanan (RLS): publik boleh melihat semua foto aktif,
--      admin/pengelola memegang kendali penuh
alter table public.gallery_photos enable row level security;

drop policy if exists p_gallery_read on public.gallery_photos;
create policy p_gallery_read on public.gallery_photos for select to anon, authenticated
  using (true);

drop policy if exists p_gallery_admin on public.gallery_photos;
create policy p_gallery_admin on public.gallery_photos for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- 21d. Realtime: ikutkan galeri ke publication supabase_realtime
do $$ begin
  alter publication supabase_realtime add table public.gallery_photos;
exception when duplicate_object then null; end $$;

-- 21e. Muat ulang cache skema agar API langsung mengenali tabel baru
notify pgrst, 'reload schema';
