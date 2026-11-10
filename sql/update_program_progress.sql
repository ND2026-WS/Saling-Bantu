-- ============================================================
-- SALING BANTU — PEMBARUAN DATABASE: DANA TERKUMPUL OTOMATIS
-- (untuk database yang SUDAH pernah menjalankan
--  supabase_schema.sql sebelumnya)
-- ------------------------------------------------------------
-- Apa yang diperbaiki:
--   Sebelumnya, dana terkumpul program (funds_collected) hanya naik
--   saat donasi DIVERIFIKASI. Ada 4 celah:
--     1. Donasi yang sudah terkonfirmasi lalu DITOLAK/dibatalkan ->
--        dana terkumpul tidak dikurangi (angka jadi lebih besar).
--     2. Admin mengubah NOMINAL donasi yang sudah terkonfirmasi ->
--        dana terkumpul tidak ikut disesuaikan.
--     3. Verifikasi ulang dua kali -> dana bisa terhitung dobel.
--     4. Donatur tidak menerima notifikasi saat donasinya ditolak.
--   File ini memasang trigger yang menghitung SELISIH (delta) dampak
--   dana pada SEMUA perubahan status/nominal donasi, sehingga dana
--   terkumpul selalu akurat di kartu program, halaman publik,
--   dashboard & laporan admin.
--
-- Aturan perhitungan dana terkumpul program:
--   - Donasi bernilai > 0 berstatus 'terkonfirmasi' (atau 'tersalurkan')
--     dihitung masuk funds_collected.
--   - Donasi jenis barang/tenaga/keahlian/jaringan dihitung dari nilai
--     setara uang yang diisi admin (kolom amount).
--   - Saat target tercapai, program otomatis menjadi 'bantuan_terpenuhi'
--     dan pemilik pengajuan + semua admin menerima notifikasi.
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel seluruh isi file ini -> Run.
-- Aman dijalankan berulang; tidak mengubah data yang sudah ada.
-- ============================================================

-- 1. Trigger verifikasi donasi versi baru (dengan delta dana + notif penolakan)
create or replace function public.fn_donation_verified() returns trigger
language plpgsql security definer set search_path = public as $$
declare need numeric; collected numeric; owner uuid; r record; delta numeric;
begin
  /* Donasi dihitung masuk dana terkumpul saat statusnya
     'terkonfirmasi' ATAU 'tersalurkan' (bernilai > 0, terikat program). */
  delta := (case when new.status in ('terkonfirmasi','tersalurkan')
                   and new.request_id is not null and new.amount > 0 then new.amount else 0 end)
         - (case when old.status in ('terkonfirmasi','tersalurkan')
                   and old.request_id is not null and old.amount > 0 then old.amount else 0 end);

  -- masuk status terkonfirmasi: catat verifikator + audit + kabari donatur
  if new.status = 'terkonfirmasi' and old.status is distinct from 'terkonfirmasi' then
    update public.donations set verified_at = now(), verified_by = auth.uid() where id = new.id;
    perform public.fn_audit(auth.uid(), 'verify', 'donations', new.id,
      jsonb_build_object('kuitansi', new.receipt_number, 'status', 'terkonfirmasi'));
    perform public.fn_notify(new.donor_id, 'donasi_tercatat', 'Donasi terkonfirmasi',
      'Donasi Anda (' || new.receipt_number || ') telah dikonfirmasi. Kuitansi digital tersedia di Riwayat Donasi.',
      'dashboard.html#donasi');
  end if;

  -- donasi ditolak (dari menunggu maupun dari terkonfirmasi): audit + kabari donatur
  if new.status = 'ditolak' and old.status is distinct from 'ditolak' then
    perform public.fn_audit(auth.uid(), 'verify_reject', 'donations', new.id,
      jsonb_build_object('kuitansi', old.receipt_number, 'dari', old.status, 'ke', 'ditolak'));
    perform public.fn_notify(new.donor_id, 'donasi_tercatat', 'Donasi ditolak',
      'Donasi ' || old.receipt_number || ' tidak lolos verifikasi. Hubungi pengelola yayasan untuk info lebih lanjut.',
      'dashboard.html#donasi');
  end if;

  -- terapkan selisih dana ke program terkait
  if delta <> 0 and new.request_id is not null then
    update public.assistance_requests
      set funds_collected = greatest(0, funds_collected + delta)
      where id = new.request_id
      returning amount_needed, funds_collected, user_id into need, collected, owner;
    if delta > 0 and need > 0 and collected >= need then
      update public.assistance_requests set status = 'bantuan_terpenuhi'
      where id = new.request_id and status in ('dipublikasikan','sedang_dibantu');
      perform public.fn_notify(owner, 'target_tercapai', 'Target tercapai!',
        'Target kebutuhan pengajuanmu telah terpenuhi. Terima kasih para sahabat bantu!',
        'dashboard.html#pengajuan');
      for r in select id from public.profiles where role = 'admin' and is_active loop
        perform public.fn_notify(r.id, 'target_tercapai', 'Target tercapai',
          'Target pengajuan terpenuhi. Jangan lupa catat penyaluran & laporan akhir.', 'admin.html#donasi');
      end loop;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_donation_verified on public.donations;
create trigger trg_donation_verified after update of status on public.donations
for each row execute function public.fn_donation_verified();

-- 2. Trigger perubahan nominal donasi yang sudah terkonfirmasi
create or replace function public.fn_donation_amount_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare need numeric; collected numeric; owner uuid;
begin
  if new.amount is distinct from old.amount
     and old.status = new.status and new.status in ('terkonfirmasi','tersalurkan')
     and new.request_id is not null then
    update public.assistance_requests
      set funds_collected = greatest(0, funds_collected + (new.amount - old.amount))
      where id = new.request_id
      returning amount_needed, funds_collected, user_id into need, collected, owner;
    if need > 0 and collected >= need then
      update public.assistance_requests set status = 'bantuan_terpenuhi'
      where id = new.request_id and status in ('dipublikasikan','sedang_dibantu');
      perform public.fn_notify(owner, 'target_tercapai', 'Target tercapai!',
        'Target kebutuhan pengajuanmu telah terpenuhi. Terima kasih para sahabat bantu!',
        'dashboard.html#pengajuan');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_donation_amount on public.donations;
create trigger trg_donation_amount after update of amount on public.donations
for each row execute function public.fn_donation_amount_changed();
