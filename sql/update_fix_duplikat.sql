-- ============================================================
-- SALING BANTU — PEMBERSIH DATA DOBEL (CERITA & KEGIATAN)
-- ------------------------------------------------------------
-- Gejala: halaman "Cerita Kebaikan" (dan daftar kegiatan di
-- halaman Transparansi) menampilkan setiap isi dua kali / lebih.
--
-- Penyebab: skema versi lama menanam data awal (cerita &
-- kegiatan contoh) dengan "on conflict do nothing", padahal
-- tabel memakai UUID acak — sehingga setiap kali file
-- supabase_schema.sql dijalankan ULANG, semua cerita & kegiatan
-- contoh ditambahkan SEKALI LAGI (judul sama, ID berbeda).
--
-- File ini menghapus salinan dobel, menyisakan SATU baris
-- tertua untuk setiap judul. Aman dijalankan berulang kali
-- (idempotent) dan TIDAK menyentuh cerita/kegiatan buatan
-- pengguna yang judulnya unik, juga tidak menyentuh data
-- pengajuan, donasi, maupun ZISWAF.
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel SELURUH isi file ini -> Run.
-- Catatan: mulai versi ini supabase_schema.sql sudah anti-dobel
--   (judul sudah ada = dilewati), sehingga masalah ini tidak
--   akan terulang.
-- ============================================================

-- 1. Jumlah SEBELUM pembersihan (lihat di tab Results)
select 'cerita (stories)'       as tabel, count(*) as jumlah from public.stories
union all
select 'kegiatan (social_events)', count(*) from public.social_events;

-- 2. Hapus cerita dobel — untuk setiap judul + penulis yang sama,
--    sisakan baris dengan created_at paling tua (data asli).
--    (event_registrations tidak terkait stories; aman dihapus)
delete from public.stories s
using public.stories d
where s.title = d.title
  and coalesce(s.author_name, '') = coalesce(d.author_name, '')
  and (s.created_at, s.ctid) > (d.created_at, d.ctid);

-- 3. Hapus kegiatan dobel — prinsip sama. Pendaftar pada salinan
--    dobel otomatis pindah & baris pendaftaran ikut terhapus
--    (FK event_registrations on delete cascade).
delete from public.social_events e
using public.social_events d
where e.title = d.title
  and (e.event_date, e.ctid) > (d.event_date, d.ctid);

-- 4. Jumlah SETELAH pembersihan — cocokkan dengan angka sebelum:
--    cerita tinggal 3 dan kegiatan tinggal 3 bila belum ada isi baru.
select 'cerita (stories)'       as tabel, count(*) as jumlah from public.stories
union all
select 'kegiatan (social_events)', count(*) from public.social_events;
