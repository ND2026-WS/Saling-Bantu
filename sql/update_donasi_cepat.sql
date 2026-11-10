-- ============================================================
-- SALING BANTU — update_donasi_cepat.sql
-- Jalur Cepat Berdonasi TANPA akun (cukup nama + nomor WhatsApp):
--   1. donor_id boleh NULL  -> donatur tamu tanpa profil akun
--   2. kolom donor_wa       -> nomor WhatsApp pemberi (tampil di panel
--      admin, dipakai admin menghubungi untuk verifikasi bukti transfer)
--   3. kebijakan RLS anon   -> tamu boleh MENGINSAJKAN donasi berstatus
--      menunggu_konfirmasi, dan hanya boleh MELIHAT barisnya sendiri
--      selama masih menunggu (setelah diverifikasi hanya admin yang
--      melihat, tamu tidak punya akses apa pun)
--   4. notifikasi admin menyebut nomor WA agar verifikasi bukti transfer
--      langsung lewat WhatsApp
-- CARA PAKAI: Dashboard Supabase -> SQL Editor -> New query -> tempel
-- SELURUH isi file ini -> Run -> muat ulang halaman website.
-- Aman dijalankan berulang kali (semua perintah idempotent).
-- ============================================================

-- 1) donor_id tidak lagi wajib: donasi tamu tidak terikat akun
alter table public.donations alter column donor_id drop not null;

-- 2) kolom nomor WhatsApp donatur (Jalur Cepat)
alter table public.donations add column if not exists donor_wa text;
comment on column public.donations.donor_wa is
  'Nomor WhatsApp donatur tamu (diisi lewat Jalur Cepat tanpa akun), format +62...';

-- 3) RLS — donasi tamu (peran anon, tanpa akun) ----------
-- tamu boleh mendaftarkan donasi: tanpa akun, status wajib menunggu,
-- donor_id wajib kosong (tidak bisa menyalahgunakan identitas orang lain)
drop policy if exists p_donations_guest_insert on public.donations;
create policy p_donations_guest_insert on public.donations for insert to anon
  with check (donor_id is null and status = 'menunggu_konfirmasi');

-- tamu hanya melihat donasi tamunya sendiri SELAMA masih menunggu
-- (diperlukan agar insert ... RETURNING di website mendapat nomor kuitansi;
--  setelah diverifikasi/ditolak barisnya otomatis tak terlihat lagi dari
--  sisi publik — hanya admin/pengelola yang tetap melihat semuanya)
drop policy if exists p_donations_guest_read on public.donations;
create policy p_donations_guest_read on public.donations for select to anon
  using (donor_id is null and status = 'menunggu_konfirmasi');

-- 4) notifikasi admin menyebut nomor WhatsApp pemberi (versi terbaru
--    trigger; menggantikan versi lama tanpa info WA)
create or replace function public.fn_donation_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; dname text; r record;
begin
  perform public.fn_audit(new.donor_id, 'create', 'donations', new.id,
    jsonb_build_object('jenis', new.type, 'jumlah', new.amount, 'kuitansi', new.receipt_number,
                       'jalur', case when new.donor_id is null then 'cepat_tamu' else 'akun' end));
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
      coalesce(' (WA: ' || new.donor_wa || ')', '') ||
      case when new.donor_id is null then ' via Jalur Cepat (bukti transfer dikirim lewat WhatsApp).' else '. Konfirmasi di menu Donasi.' end,
      'admin.html#donasi');
  end loop;
  return new;
end $$;
drop trigger if exists trg_donation_created on public.donations;
create trigger trg_donation_created after insert on public.donations
for each row execute function public.fn_donation_created();

-- 5) segarkan cache skema PostgREST agar kolom baru langsung dikenali
notify pgrst, 'reload schema';
