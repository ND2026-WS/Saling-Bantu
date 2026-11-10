-- ============================================================
-- SALING BANTU — update_admin_program.sql
-- ------------------------------------------------------------
-- Fitur "Tambah Program / Pengajuan" di panel admin:
-- 1. KOLOM BARU beneficiary_name pada assistance_requests — menyimpan
--    nama penerima/golongan (mis. "30 santri yatim") yang boleh berbeda
--    dari pemilik akun. TANPA KOLOM INI form Tambah Program dan form
--    Ajukan Bantuan akan gagal dengan error:
--    "Could not find the 'beneficiary_name' column ... in the schema cache".
-- 2. Kebijakan RLS assistance_requests diperluas — selain admin,
--    peran PENGELOLA juga boleh membuat/mengelola pengajuan
--    (p_requests_admin kini memakai is_pengelola()).
-- 3. NOTIFIKASI DONASI MASUK untuk admin — setiap ada donasi baru
--    (finansial/barang/tenaga/keahlian/jaringan), semua admin aktif
--    menerima notifikasi lonceng "Donasi baru menunggu konfirmasi"
--    dengan tautan langsung ke menu Donasi.
--
-- Jalankan di SQL Editor Supabase — aman dijalankan berulang.
-- Database baru tidak butuh file ini (sudah ada di supabase_schema.sql).
-- ============================================================

-- (1) kolom beneficiary_name — untuk database lama yang belum punya
alter table public.assistance_requests
  add column if not exists beneficiary_name text not null default '';

-- segarkan cache skema PostgREST agar kolom baru langsung dikenali
notify pgrst, 'reload schema';

-- (2) fungsi is_pengelola(): admin ATAU pengelola
create or replace function public.is_pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin','pengelola') and is_active
  );
$$;

-- (3) admin & pengelola full akses pada assistance_requests
drop policy if exists p_requests_admin on public.assistance_requests;
create policy p_requests_admin on public.assistance_requests for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- catatan: pengguna biasa tetap hanya bisa mengajukan dengan status
-- 'menunggu_verifikasi' (kebijakan p_requests_insert tidak berubah).

-- (4) trigger donasi baru: audit + notifikasi pemilik pengajuan +
--     notifikasi semua admin aktif (diperbarui dari versi schema awal)
create or replace function public.fn_donation_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; title text; dname text; r record;
begin
  perform public.fn_audit(new.donor_id, 'create', 'donations', new.id,
    jsonb_build_object('jenis', new.type, 'jumlah', new.amount, 'kuitansi', new.receipt_number));
  if new.request_id is not null then
    select user_id, title into owner, title from public.assistance_requests where id = new.request_id;
    dname := case when new.is_anonymous then 'Sahabat Bantu (anonim)' else new.donor_name end;
    perform public.fn_notify(owner, 'donasi_tercatat', 'Ada niat baik untuk pengajuanmu',
      dname || ' memberikan bantuan (' || new.type::text || ') untuk "' || title || '".',
      'dashboard.html#pengajuan');
  end if;
  -- kabari semua admin aktif: donasi baru menunggu konfirmasi di modul Donasi
  for r in select id from public.profiles where role = 'admin' and is_active loop
    perform public.fn_notify(r.id, 'donasi_tercatat', 'Donasi baru menunggu konfirmasi',
      coalesce(new.receipt_number, 'Donasi baru') || ' — ' || new.type::text || ' dari ' ||
      case when new.is_anonymous then 'Hamba Allah' else coalesce(new.donor_name, 'Sahabat Bantu') end ||
      '. Konfirmasi di menu Donasi.',
      'admin.html#donasi');
  end loop;
  return new;
end $$;
