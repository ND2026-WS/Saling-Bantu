-- ============================================================
-- SALING BANTU — PEMBARUAN DATABASE: HAPUS DATA + REALTIME
-- (untuk database yang SUDAH pernah menjalankan
--  supabase_schema.sql sebelumnya)
-- ------------------------------------------------------------
-- Apa isi pembaruan ini:
--   1. TOMBOL HAPUS di semua menu admin/pengelola:
--      kebijakan RLS (Row Level Security) diselaraskan agar
--      admin ATAU pengelola dapat mengedit/menghapus data pada
--      tabel donasi, penyaluran, cerita, kegiatan, dan komunitas.
--      (Penghapusan akun pengguna tetap hanya untuk admin.)
--   2. Trigger penghapus yang menjaga angka tetap akurat:
--      - Donasi terkonfirmasi dihapus  -> dana TERKUMPUL program
--        otomatis berkurang (tidak ada angka "hantu").
--      - Penyaluran dihapus            -> dana TERSALUR program
--        otomatis berkurang.
--      Semua penghapusan tercatat di jejak audit (audit_logs).
--   3. REALTIME untuk SEMUA halaman: seluruh tabel utama
--      didaftarkan ke publication supabase_realtime sehingga
--      beranda, dashboard, panel admin, dan halaman publik
--      memuat ulang data otomatis begitu ada perubahan
--      (donasi baru masuk, verifikasi admin, hapus data, dsb)
--      tanpa menekan tombol segarkan.
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel SELURUH isi file ini -> Run.
-- Aman dijalankan berulang (idempoten); tidak mengubah data.
-- ============================================================

-- ============================================================
-- BAGIAN A — KEBIJAKAN RLS UNTUK FITUR HAPUS
-- ============================================================

-- A1. donasi: admin & pengelola boleh edit + hapus
drop policy if exists p_donations_admin on public.donations;
create policy p_donations_admin on public.donations for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- A2. penyaluran bantuan: admin & pengelola
drop policy if exists p_dist_admin on public.assistance_distributions;
create policy p_dist_admin on public.assistance_distributions for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- A3. cerita: admin/pengelola, atau penulisnya sendiri
drop policy if exists p_stories_admin on public.stories;
create policy p_stories_admin on public.stories for all to authenticated
  using (public.is_pengelola() or author_id = auth.uid())
  with check (public.is_pengelola() or author_id = auth.uid());

-- A4. kegiatan: admin/pengelola, atau pembuat kegiatan
drop policy if exists p_events_admin on public.social_events;
create policy p_events_admin on public.social_events for all to authenticated
  using (public.is_pengelola() or created_by = auth.uid())
  with check (public.is_pengelola() or created_by = auth.uid());

-- A5. komunitas: admin/pengelola, atau pembuat komunitas
drop policy if exists p_comm_admin on public.communities;
create policy p_comm_admin on public.communities for all to authenticated
  using (public.is_pengelola() or created_by = auth.uid())
  with check (public.is_pengelola() or created_by = auth.uid());

-- Catatan: pengajuan (assistance_requests), ZISWAF (ziswaf_transactions,
-- ziswaf_distributions), dan profiles sudah punya kebijakan yang tepat.

-- ============================================================
-- BAGIAN B — TRIGGER PENGHAPUS YANG MENJAGA ANGKA AKURAT
-- ============================================================

-- B1. hapus donasi -> dana terkumpul program berkurang otomatis
create or replace function public.fn_donation_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status in ('terkonfirmasi','tersalurkan')
     and old.request_id is not null and old.amount > 0 then
    update public.assistance_requests
      set funds_collected = greatest(0, funds_collected - old.amount)
      where id = old.request_id;
  end if;
  perform public.fn_audit(auth.uid(), 'delete', 'donations', old.id,
    jsonb_build_object('kuitansi', old.receipt_number, 'jumlah', old.amount, 'status', old.status));
  return old;
end $$;
drop trigger if exists trg_donation_deleted on public.donations;
create trigger trg_donation_deleted after delete on public.donations
for each row execute function public.fn_donation_deleted();

-- B2. hapus penyaluran -> dana tersalur program berkurang otomatis
create or replace function public.fn_distribution_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.assistance_requests ar
    set funds_distributed = greatest(0, ar.funds_distributed - coalesce(old.amount, 0))
    where ar.id = old.request_id;
  perform public.fn_audit(auth.uid(), 'delete', 'assistance_distributions', old.id,
    jsonb_build_object('request_id', old.request_id, 'jumlah', old.amount));
  return old;
end $$;
drop trigger if exists trg_distribution_deleted on public.assistance_distributions;
create trigger trg_distribution_deleted after delete on public.assistance_distributions
for each row execute function public.fn_distribution_deleted();

-- ============================================================
-- BAGIAN C — REALTIME UNTUK SEMUA TABEL UTAMA
-- ============================================================
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
do $$ begin
  alter publication supabase_realtime add table public.ziswaf_transactions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.ziswaf_distributions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.social_events;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.event_registrations;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.communities;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.community_members;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.volunteers;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.donation_transactions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.verification_logs;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Segarkan cache skema PostgREST agar API langsung mengenali perubahan
notify pgrst, 'reload schema';

-- ============================================================
-- SELESAI. Muat ulang halaman aplikasi (Ctrl+F5) setelah ini.
-- ============================================================
