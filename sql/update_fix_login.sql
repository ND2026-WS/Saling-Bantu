-- ============================================================
-- SALING BANTU — update_fix_login.sql
-- ------------------------------------------------------------
-- Perbaikan akses login: mengizinkan pengguna membuat baris
-- profil miliknya SENDIRI di tabel profiles (id = auth.uid()).
--
-- Dipakai oleh fitur "auto-profile" saat login: bila ada akun
-- yang dibuat langsung dari Dashboard Supabase (Authentication
-- > Add user) atau trigger handle_new_user belum terpasang,
-- aplikasi akan otomatis membuat baris profiles-nya saat login.
--
-- Jalankan di SQL Editor Supabase — aman dijalankan berulang.
-- ============================================================

drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- (opsional) pastikan trigger pembuat profil juga terpasang:
-- bila sudah ada, perintah ini tidak mengubah apa pun.
-- Lihat sql/supabase_schema.sql bagian public.handle_new_user().
