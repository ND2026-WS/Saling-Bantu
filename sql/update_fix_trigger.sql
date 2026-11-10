-- ============================================================
-- SALING BANTU — update_fix_trigger.sql
-- ------------------------------------------------------------
-- PERBAIKAN BUG: "column reference 'title' is ambiguous"
-- (muncul saat donatur menekan "Kirim Niat Baik")
--
-- Penyebab: di dalam fungsi trigger PL/pgSQL, nama variabel SAMAI
-- dengan nama kolom tabel (variabel `title` di fn_donation_created,
-- variabel `code` di fn_distribution_created) membuat PostgreSQL
-- bingung antara kolom dan variabel — semua donasi yang terhubung
-- ke pengajuan ditolak dengan error ambiguous.
--
-- Perbaikan: variabel diawali v_ dan semua kolom diberi alias tabel
-- (ar.user_id, ar.title, ar.code). Tidak ada data yang berubah —
-- hanya definisi dua fungsi berikut yang diganti.
--
-- Jalankan di SQL Editor Supabase — aman dijalankan berulang.
-- Database baru tidak butuh file ini (sudah benar di supabase_schema.sql).
-- ============================================================

-- (1) trigger donasi baru: audit + notifikasi pemilik pengajuan +
--     notifikasi semua admin aktif
create or replace function public.fn_donation_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; dname text; r record;
begin
  perform public.fn_audit(new.donor_id, 'create', 'donations', new.id,
    jsonb_build_object('jenis', new.type, 'jumlah', new.amount, 'kuitansi', new.receipt_number));
  if new.request_id is not null then
    select ar.user_id, ar.title into v_owner, v_title
      from public.assistance_requests ar where ar.id = new.request_id;
    dname := case when new.is_anonymous then 'Sahabat Bantu (anonim)' else new.donor_name end;
    perform public.fn_notify(v_owner, 'donasi_tercatat', 'Ada niat baik untuk pengajuanmu',
      dname || ' memberikan bantuan (' || new.type::text || ') untuk "' || v_title || '".',
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

-- (2) trigger penyaluran bantuan: dana tersalur + notifikasi pemilik
--     (bug serupa: variabel `code` bentrok dengan kolom `code`)
create or replace function public.fn_distribution_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_code text;
begin
  update public.assistance_requests ar
  set funds_distributed = ar.funds_distributed + coalesce(new.amount, 0)
  where ar.id = new.request_id
  returning ar.user_id, ar.code into v_owner, v_code;
  perform public.fn_audit(auth.uid(), 'create', 'assistance_distributions', new.id,
    jsonb_build_object('request', v_code, 'jumlah', new.amount));
  perform public.fn_notify(v_owner, 'bantuan_diterima', 'Bantuan disalurkan',
    'Bantuan untuk pengajuan ' || v_code || ' telah disalurkan. Cek detail di dashboard.',
    'dashboard.html#pengajuan');
  return new;
end $$;

-- (3) helper pengelola (diperlukan kebijakan di bawah; aman bila sudah ada)
create or replace function public.is_pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin','pengelola') and is_active
  );
$$;

-- (4) ZISWAF: donor_id boleh KOSONG — donatur tunai tanpa akun
--     (siswa setor di kelas, umum menitipkan via bendahara). Tanpa ini,
--     seed data dan pencatatan ZISWAF tunai gagal:
--     "null value in column donor_id violates not-null constraint".
alter table public.ziswaf_transactions alter column donor_id drop not null;

-- (5) pengelola boleh mencatat ZISWAF atas nama pemberi tanpa akun
drop policy if exists p_ziswaf_tx_insert on public.ziswaf_transactions;
create policy p_ziswaf_tx_insert on public.ziswaf_transactions for insert to authenticated
  with check (donor_id = auth.uid() or public.is_pengelola());

-- (6) kolom updated_at pada donations — trigger fn_touch() (otomatis mengisi
--     waktu pembaruan) terpasang di tabel ini, tapi kolomnya belum ada.
--     Tanpa ini SETIAP update donasi (termasuk tombol Konfirmasi) gagal:
--     'record "new" has no field "updated_at"'.
alter table public.donations add column if not exists updated_at timestamptz not null default now();
