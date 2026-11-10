-- ============================================================
--  SALING BANTU — "Ringankan Beban, Tebarkan Kebaikan"
--  Skema Database Supabase (PostgreSQL) — v1.0 (re-runnable)
--  ------------------------------------------------------------
--  CARA PAKAI:
--   1) Buat proyek di https://supabase.com -> New project
--   2) SQL Editor -> New query -> tempel SELURUH file ini -> Run
--   3) Ambil Project URL + anon public key (Settings -> API)
--      lalu isi js/config.js
--  KEAMANAN:
--   - Frontend hanya memakai anon key; semua proteksi ditegakkan
--     di sini lewat RLS + trigger.
--   - Pengguna TIDAK BISA mengubah status verifikasi pengajuannya
--     sendiri (UPDATE hanya untuk admin).
--   - View transparansi menyamarkan identitas penerima.
-- ============================================================

-- ============================================================
-- BAGIAN 1 — EKSTENSI & TIPE ENUM
-- ============================================================
create extension if not exists "pgcrypto";

do $$ begin
  create type app_role as enum ('admin','penerima','donatur','volunteer');
exception when duplicate_object then null; end $$;

-- 8 status pengajuan (sesuai spesifikasi)
do $$ begin
  create type request_status as enum (
    'menunggu_verifikasi','dalam_verifikasi','terverifikasi','dipublikasikan',
    'sedang_dibantu','bantuan_terpenuhi','selesai','ditolak');
exception when duplicate_object then null; end $$;

-- 5 jenis bantuan
do $$ begin
  create type donation_type as enum ('finansial','barang','tenaga','keahlian','jaringan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type donation_status as enum ('menunggu_konfirmasi','terkonfirmasi','ditolak','tersalurkan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type story_status as enum ('menunggu_review','disetujui','ditolak');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_status as enum ('terjadwal','berlangsung','selesai','dibatalkan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('ketua','anggota');
exception when duplicate_object then null; end $$;

-- 8 jenis notifikasi (spesifikasi) + 1 tambahan: penolakan
do $$ begin
  create type notification_type as enum (
    'pengajuan_diterima','verifikasi_dimulai','pengajuan_disetujui','bantuan_diterima',
    'donasi_tercatat','target_tercapai','kabar_volunteer','laporan_dipublikasikan',
    'pengajuan_ditolak');
exception when duplicate_object then null; end $$;

create sequence if not exists req_code_seq start 1;
create sequence if not exists receipt_seq start 1;

-- ============================================================
-- BAGIAN 2 — TABEL MASTER: ROLES & KATEGORI
-- ============================================================
create table if not exists public.roles (
  id          smallserial primary key,
  name        app_role not null unique,
  description text not null default ''
);

create table if not exists public.assistance_categories (
  id          bigserial primary key,
  code        text not null unique,
  name        text not null,
  icon        text not null default 'heart',
  color       text not null default 'hijau',
  description text not null default '',
  sub_items   jsonb not null default '[]'::jsonb,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- BAGIAN 3 — PROFIL PENGGUNA (1:1 dengan auth.users)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text not null default 'Sahabat Bantu',
  phone        text not null default '',
  role         app_role not null default 'donatur',
  city         text not null default '',
  bio          text not null default '',
  avatar_url   text,
  is_verified  boolean not null default false,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- BAGIAN 4 — PENGAJUAN BANTUAN (8 status)
-- ============================================================
create table if not exists public.assistance_requests (
  id               uuid primary key default gen_random_uuid(),
  code             text unique,                       -- SB-YYYY-0001
  user_id          uuid not null references public.profiles(id) on delete cascade,
  beneficiary_name text not null default '',          -- nama penerima/golongan (boleh beda dari pemilik akun; dipakai fitur Tambah Program admin)
  category_code    text not null references public.assistance_categories(code),
  sub_category     text not null default '',
  title            text not null,
  description      text not null,
  amount_needed    numeric(14,2) not null default 0 check (amount_needed >= 0),
  funds_collected  numeric(14,2) not null default 0,
  funds_distributed numeric(14,2) not null default 0,
  city             text not null default '',          -- yang ditampilkan publik
  province         text not null default '',
  contact          text not null default '',          -- hanya dilihat admin
  photo_url        text,
  document_url     text,
  status           request_status not null default 'menunggu_verifikasi',
  rejection_reason text,
  is_public        boolean not null default true,
  verified_by      uuid references public.profiles(id),
  published_at     timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- BAGIAN 5 — DONASI, TRANSAKSI & PENYALURAN
-- ============================================================
create table if not exists public.donations (
  id               uuid primary key default gen_random_uuid(),
  receipt_number   text unique,                       -- KWT-YYYYMMDD-00001
  request_id       uuid references public.assistance_requests(id) on delete set null,
  donor_id         uuid references public.profiles(id) on delete cascade,
                   -- NULL = donatur tamu lewat Jalur Cepat (tanpa akun, nama + WA)
  donor_name       text not null default '',
  donor_wa         text,                              -- nomor WhatsApp donatur tamu (+62...)
  is_anonymous     boolean not null default false,
  type             donation_type not null,
  amount           numeric(14,2) not null default 0 check (amount >= 0),
  item_description text not null default '',          -- untuk jenis barang/tenaga/keahlian/jaringan
  message          text not null default '',
  status           donation_status not null default 'menunggu_konfirmasi',
  proof_url        text,
  verified_by      uuid references public.profiles(id),
  verified_at      timestamptz,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table if not exists public.donation_transactions (
  id           uuid primary key default gen_random_uuid(),
  donation_id  uuid not null references public.donations(id) on delete cascade,
  channel      text not null default 'transfer_bank',
  reference_no text not null default '',
  amount       numeric(14,2) not null default 0,
  paid_at      timestamptz,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.assistance_distributions (
  id               uuid primary key default gen_random_uuid(),
  request_id       uuid not null references public.assistance_requests(id) on delete cascade,
  donation_id      uuid references public.donations(id) on delete set null,
  type             donation_type not null,
  amount           numeric(14,2) not null default 0,
  item_description text not null default '',
  proof_url        text,
  note             text not null default '',
  distributed_by   uuid references public.profiles(id),
  distributed_at   timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- BAGIAN 6 — VOLUNTEER & KOMUNITAS & KEGIATAN
-- ============================================================
create table if not exists public.volunteers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references public.profiles(id) on delete cascade,
  skills       text[] not null default '{}',
  city         text not null default '',
  availability text not null default 'akhir_pekan', -- akhir_pekan | weekdays | fleksibel
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.communities (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  slug         text not null unique,
  description  text not null default '',
  city         text not null default '',
  logo_url     text,
  created_by   uuid references public.profiles(id) on delete set null,
  member_count integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.community_members (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         member_role not null default 'anggota',
  joined_at    timestamptz not null default now(),
  unique (community_id, user_id)
);

create table if not exists public.social_events (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text not null default '',
  event_type       text not null default 'volunteer' check (event_type in ('volunteer','komunitas','donasi')),
  category_code    text references public.assistance_categories(code),
  community_id     uuid references public.communities(id) on delete set null,
  location         text not null default '',
  event_date       timestamptz not null,
  quota            integer not null default 0,        -- 0 = tanpa kuota
  registered_count integer not null default 0,
  cover_url        text,
  status           event_status not null default 'terjadwal',
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- tabel pelengkap agar fitur "daftar kegiatan" berfungsi penuh
create table if not exists public.event_registrations (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.social_events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  message    text not null default '',
  attended   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ============================================================
-- BAGIAN 7 — KONTEN: CERITA
-- ============================================================
create table if not exists public.stories (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.profiles(id) on delete set null,
  author_name  text not null default 'Sahabat Bantu',
  title        text not null,
  content      text not null,
  photo_url    text,
  category_code text references public.assistance_categories(code),
  status       story_status not null default 'menunggu_review',
  is_published boolean not null default false,
  views        integer not null default 0,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

-- ============================================================
-- BAGIAN 8 — NOTIFIKASI & LOG
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       notification_type not null,
  title      text not null,
  message    text not null default '',
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_logs (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.assistance_requests(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  from_status request_status,
  to_status   request_status not null,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id        uuid primary key default gen_random_uuid(),
  actor_id  uuid references public.profiles(id) on delete set null,
  action    text not null,                            -- create | update | update_status | delete | login...
  entity    text not null,                            -- assistance_requests | donations | profiles ...
  entity_id uuid,
  detail    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- BAGIAN 9 — INDEX
-- ============================================================
create index if not exists idx_requests_status   on public.assistance_requests(status);
create index if not exists idx_requests_user     on public.assistance_requests(user_id);
create index if not exists idx_requests_category on public.assistance_requests(category_code);
create index if not exists idx_requests_city     on public.assistance_requests(city);
create index if not exists idx_donations_request on public.donations(request_id);
create index if not exists idx_donations_donor   on public.donations(donor_id);
create index if not exists idx_notif_user        on public.notifications(user_id, is_read);
create index if not exists idx_vlogs_request     on public.verification_logs(request_id);
create index if not exists idx_events_date       on public.social_events(event_date);

-- ============================================================
-- BAGIAN 10 — FUNGSI BANTU (helper)
-- ============================================================

-- apakah pengguna saat ini admin aktif?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- admin ATAU pengelola (didefinisikan awal agar bisa dipakai kebijakan RLS di bawah)
create or replace function public.is_pengelola() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text in ('admin','pengelola') and is_active
  );
$$;

-- updated_at otomatis
create or replace function public.fn_touch() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.fn_touch();

drop trigger if exists trg_requests_touch on public.assistance_requests;
create trigger trg_requests_touch before update on public.assistance_requests
for each row execute function public.fn_touch();

drop trigger if exists trg_donations_touch on public.donations;
create trigger trg_donations_touch before update on public.donations
for each row execute function public.fn_touch();

-- helper kirim notifikasi
create or replace function public.fn_notify(
  p_user uuid, p_type notification_type, p_title text, p_msg text, p_link text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is not null then
    insert into public.notifications (user_id, type, title, message, link)
    values (p_user, p_type, p_title, p_msg, p_link);
  end if;
end $$;

-- audit helper
create or replace function public.fn_audit(
  p_actor uuid, p_action text, p_entity text, p_entity_id uuid, p_detail jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, detail)
  values (p_actor, p_action, p_entity, p_entity_id, p_detail);
end $$;

-- kode pengajuan otomatis: SB-2026-0001
create or replace function public.fn_request_code() returns trigger
language plpgsql as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'SB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('req_code_seq')::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists trg_request_code on public.assistance_requests;
create trigger trg_request_code before insert on public.assistance_requests
for each row execute function public.fn_request_code();

-- nomor kuitansi otomatis: KWT-20261108-00001
create or replace function public.fn_receipt_no() returns trigger
language plpgsql as $$
begin
  if new.receipt_number is null or new.receipt_number = '' then
    new.receipt_number := 'KWT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_seq')::text, 5, '0');
  end if;
  if new.donor_name = '' and new.donor_id is not null then
    select full_name into new.donor_name from public.profiles where id = new.donor_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_receipt_no on public.donations;
create trigger trg_receipt_no before insert on public.donations
for each row execute function public.fn_receipt_no();

-- ============================================================
-- BAGIAN 11 — TRIGGER AUTH: buat profile otomatis saat mendaftar
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'phone',''),
    coalesce((new.raw_user_meta_data->>'role')::app_role, 'donatur')
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- BAGIAN 12 — TRIGGER PENGAJUAN: notifikasi + audit + log verifikasi
-- ============================================================
create or replace function public.fn_request_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform public.fn_audit(new.user_id, 'create', 'assistance_requests', new.id,
    jsonb_build_object('code', new.code, 'kategori', new.category_code, 'judul', new.title));
  -- notifikasi ke semua admin
  for r in select id from public.profiles where role = 'admin' and is_active loop
    perform public.fn_notify(r.id, 'pengajuan_diterima', 'Pengajuan baru masuk',
      'Pengajuan "' || new.title || '" (' || new.code || ') menunggu verifikasi.', 'admin.html#pengajuan');
  end loop;
  -- notifikasi ke pengaju
  perform public.fn_notify(new.user_id, 'pengajuan_diterima', 'Pengajuan berhasil dikirim',
    'Pengajuan "' || new.title || '" dengan kode ' || new.code || ' sedang menunggu verifikasi admin.',
    'dashboard.html#pengajuan');
  return new;
end $$;
drop trigger if exists trg_request_created on public.assistance_requests;
create trigger trg_request_created after insert on public.assistance_requests
for each row execute function public.fn_request_created();

create or replace function public.fn_request_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.verification_logs (request_id, changed_by, from_status, to_status, note)
    values (new.id, auth.uid(), old.status, new.status, coalesce(new.rejection_reason, ''));
    perform public.fn_audit(auth.uid(), 'update_status', 'assistance_requests', new.id,
      jsonb_build_object('dari', old.status, 'ke', new.status));

    if new.status = 'dalam_verifikasi' then
      perform public.fn_notify(new.user_id, 'verifikasi_dimulai', 'Pengajuan sedang diverifikasi',
        'Tim kami sedang memverifikasi pengajuan ' || new.code || '. Anda akan diberi kabar segera.',
        'dashboard.html#pengajuan');
    elsif new.status = 'terverifikasi' then
      perform public.fn_notify(new.user_id, 'pengajuan_disetujui', 'Pengajuan terverifikasi',
        'Selamat! Pengajuan ' || new.code || ' telah lolos verifikasi dan akan dipublikasikan.',
        'dashboard.html#pengajuan');
    elsif new.status = 'dipublikasikan' then
      perform public.fn_notify(new.user_id, 'pengajuan_disetujui', 'Pengajuan dipublikasikan',
        'Pengajuan ' || new.code || ' kini terlihat publik dan mulai bisa menerima bantuan.',
        'dashboard.html#pengajuan');
    elsif new.status = 'sedang_dibantu' then
      perform public.fn_notify(new.user_id, 'bantuan_diterima', 'Kabar baik: bantuan mulai mengalir',
        'Pengajuan ' || new.code || ' sedang mendapat bantuan dari para sahabat bantu.',
        'dashboard.html#pengajuan');
    elsif new.status = 'bantuan_terpenuhi' then
      perform public.fn_notify(new.user_id, 'bantuan_diterima', 'Bantuan terpenuhi',
        'Kebutuhan pengajuan ' || new.code || ' telah terpenuhi. Terima kasih para pemberi!',
        'dashboard.html#pengajuan');
    elsif new.status = 'selesai' then
      perform public.fn_notify(new.user_id, 'laporan_dipublikasikan', 'Laporan akhir dipublikasikan',
        'Laporan penggunaan bantuan ' || new.code || ' telah dipublikasikan di halaman Transparansi.',
        'transparansi.html');
    elsif new.status = 'ditolak' then
      perform public.fn_notify(new.user_id, 'pengajuan_ditolak', 'Pengajuan ditolak',
        'Pengajuan ' || new.code || ' ditolak. Alasan: ' || coalesce(new.rejection_reason, '-'),
        'dashboard.html#pengajuan');
    end if;

    if new.status = 'dipublikasikan' and new.published_at is null then
      new.published_at := now();
    end if;
    if new.status = 'selesai' and new.completed_at is null then
      new.completed_at := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_request_status on public.assistance_requests;
create trigger trg_request_status before update of status on public.assistance_requests
for each row execute function public.fn_request_status_changed();

-- ============================================================
-- BAGIAN 13 — TRIGGER DONASI: notifikasi + dana terkumpul + target
-- ============================================================
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

create or replace function public.fn_donation_verified() returns trigger
language plpgsql security definer set search_path = public as $$
declare need numeric; collected numeric; owner uuid; r record; delta numeric;
begin
  /* Dana terkumpul program OTOMATIS mengikuti status donasi.
     Aturan: donasi bernilai > 0 yang statusnya 'terkonfirmasi' ATAU
     'tersalurkan' dihitung masuk funds_collected. Selisih (delta) dihitung
     dari kondisi lama vs baru, sehingga aman untuk semua transisi:
     - menunggu -> terkonfirmasi   : dana NAIK sebesar nominal
     - terkonfirmasi -> ditolak    : dana TURUN kembali (dibatalkan)
     - terkonfirmasi <-> tersalurkan : dana tetap (tetap terhitung)
     - verifikasi ulang dua kali   : tidak dobel hitung (delta = 0) */
  delta := (case when new.status in ('terkonfirmasi','tersalurkan')
                   and new.request_id is not null and new.amount > 0 then new.amount else 0 end)
         - (case when old.status in ('terkonfirmasi','tersalurkan')
                   and old.request_id is not null and old.amount > 0 then old.amount else 0 end);

  if new.status = 'terkonfirmasi' and old.status is distinct from 'terkonfirmasi' then
    update public.donations set verified_at = now(), verified_by = auth.uid() where id = new.id;
    perform public.fn_audit(auth.uid(), 'verify', 'donations', new.id,
      jsonb_build_object('kuitansi', new.receipt_number, 'status', 'terkonfirmasi'));
    perform public.fn_notify(new.donor_id, 'donasi_tercatat', 'Donasi terkonfirmasi',
      'Donasi Anda (' || new.receipt_number || ') telah dikonfirmasi. Kuitansi digital tersedia di Riwayat Donasi.',
      'dashboard.html#donasi');
  end if;

  if new.status = 'ditolak' and old.status is distinct from 'ditolak' then
    perform public.fn_audit(auth.uid(), 'verify_reject', 'donations', new.id,
      jsonb_build_object('kuitansi', old.receipt_number, 'dari', old.status, 'ke', 'ditolak'));
    perform public.fn_notify(new.donor_id, 'donasi_tercatat', 'Donasi ditolak',
      'Donasi ' || old.receipt_number || ' tidak lolos verifikasi. Hubungi pengelola yayasan untuk info lebih lanjut.',
      'dashboard.html#donasi');
  end if;

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

/* Nominal donasi yang SUDAH terkonfirmasi diedit admin -> dana terkumpul
   program ikut disesuaikan (selisih nominal), tanpa menyentuh status. */
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

-- hapus donasi: bila donasi yang dihapus sedang dihitung ke dana terkumpul
-- (terkonfirmasi/tersalurkan, bernilai > 0, terikat program), dana terkumpul
-- program dikurangi kembali sehingga kartu program selalu akurat.
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

-- ============================================================
-- BAGIAN 14 — TRIGGER PENYALURAN: dana tersalur + notifikasi
-- ============================================================
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
drop trigger if exists trg_distribution_created on public.assistance_distributions;
create trigger trg_distribution_created after insert on public.assistance_distributions
for each row execute function public.fn_distribution_created();

-- hapus penyaluran: dana tersalur program dikurangi kembali (selisih)
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
-- BAGIAN 15 — ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.profiles              enable row level security;
alter table public.roles                 enable row level security;
alter table public.assistance_categories enable row level security;
alter table public.assistance_requests   enable row level security;
alter table public.donations             enable row level security;
alter table public.donation_transactions enable row level security;
alter table public.assistance_distributions enable row level security;
alter table public.volunteers            enable row level security;
alter table public.communities           enable row level security;
alter table public.community_members     enable row level security;
alter table public.social_events         enable row level security;
alter table public.event_registrations   enable row level security;
alter table public.stories               enable row level security;
alter table public.notifications         enable row level security;
alter table public.verification_logs     enable row level security;
alter table public.audit_logs            enable row level security;

-- ---- profiles ----
drop policy if exists p_profiles_read   on public.profiles;
create policy p_profiles_read on public.profiles for select to authenticated using (true);
-- izinkan pengguna membuat baris profil miliknya SENDIRI (dipakai auto-profile
-- saat login bila akun dibuat langsung dari Dashboard Supabase / trigger belum ada)
drop policy if exists p_profiles_insert on public.profiles;
create policy p_profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists p_profiles_update on public.profiles;
create policy p_profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
-- insert pengguna lain dilakukan trigger security definer; delete hanya admin
drop policy if exists p_profiles_admin on public.profiles;
create policy p_profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- roles & kategori: baca publik, tulis admin ----
drop policy if exists p_roles_read on public.roles;
create policy p_roles_read on public.roles for select to anon, authenticated using (true);
drop policy if exists p_roles_admin on public.roles;
create policy p_roles_admin on public.roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists p_cats_read on public.assistance_categories;
create policy p_cats_read on public.assistance_categories for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists p_cats_admin on public.assistance_categories;
create policy p_cats_admin on public.assistance_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- pengajuan ----
-- publik (termasuk anonim) hanya melihat yang dipublikasikan
drop policy if exists p_requests_public on public.assistance_requests;
create policy p_requests_public on public.assistance_requests for select to anon, authenticated
  using (is_public and status in ('dipublikasikan','sedang_dibantu','bantuan_terpenuhi','selesai'));
-- pemilik melihat pengajuannya sendiri
drop policy if exists p_requests_owner on public.assistance_requests;
create policy p_requests_owner on public.assistance_requests for select to authenticated
  using (user_id = auth.uid());
-- admin & pengelola full (termasuk fitur "Tambah Program" dari panel admin)
drop policy if exists p_requests_admin on public.assistance_requests;
create policy p_requests_admin on public.assistance_requests for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());
-- pengguna bisa MENGAJUKAN, tapi tidak bisa mengubah/menghapus
drop policy if exists p_requests_insert on public.assistance_requests;
create policy p_requests_insert on public.assistance_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'menunggu_verifikasi');

-- ---- donasi ----
drop policy if exists p_donations_insert on public.donations;
create policy p_donations_insert on public.donations for insert to authenticated
  with check (donor_id = auth.uid());
drop policy if exists p_donations_read on public.donations;
create policy p_donations_read on public.donations for select to authenticated
  using (donor_id = auth.uid()
         or public.is_admin()
         or exists (select 1 from public.assistance_requests r
                    where r.id = donations.request_id and r.user_id = auth.uid()));
drop policy if exists p_donations_admin on public.donations;
create policy p_donations_admin on public.donations for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());
-- Jalur Cepat Berdonasi (tanpa akun): tamu (anon) mendaftarkan donasi
-- dengan nama + nomor WA; hanya boleh status menunggu dan donor_id kosong
-- setelah admin memverifikasi, barisnya tidak lagi terlihat dari sisi publik.
drop policy if exists p_donations_guest_insert on public.donations;
create policy p_donations_guest_insert on public.donations for insert to anon
  with check (donor_id is null and status = 'menunggu_konfirmasi');
drop policy if exists p_donations_guest_read on public.donations;
create policy p_donations_guest_read on public.donations for select to anon
  using (donor_id is null and status = 'menunggu_konfirmasi');

drop policy if exists p_trans_read on public.donation_transactions;
create policy p_trans_read on public.donation_transactions for select to authenticated
  using (public.is_admin()
         or exists (select 1 from public.donations d where d.id = donation_transactions.donation_id and d.donor_id = auth.uid()));
drop policy if exists p_trans_admin on public.donation_transactions;
create policy p_trans_admin on public.donation_transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists p_dist_read on public.assistance_distributions;
create policy p_dist_read on public.assistance_distributions for select to anon, authenticated using (true);
drop policy if exists p_dist_admin on public.assistance_distributions;
create policy p_dist_admin on public.assistance_distributions for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- ---- volunteer ----
drop policy if exists p_vol_read on public.volunteers;
create policy p_vol_read on public.volunteers for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists p_vol_own on public.volunteers;
create policy p_vol_own on public.volunteers for all to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- ---- komunitas ----
drop policy if exists p_comm_read on public.communities;
create policy p_comm_read on public.communities for select to anon, authenticated using (true);
drop policy if exists p_comm_insert on public.communities;
create policy p_comm_insert on public.communities for insert to authenticated with check (true);
drop policy if exists p_comm_admin on public.communities;
create policy p_comm_admin on public.communities for all to authenticated
  using (public.is_pengelola() or created_by = auth.uid()) with check (public.is_pengelola() or created_by = auth.uid());

drop policy if exists p_cmembers_read on public.community_members;
create policy p_cmembers_read on public.community_members for select to anon, authenticated using (true);
drop policy if exists p_cmembers_write on public.community_members;
create policy p_cmembers_write on public.community_members for all to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- ---- kegiatan & pendaftaran ----
drop policy if exists p_events_read on public.social_events;
create policy p_events_read on public.social_events for select to anon, authenticated using (true);
drop policy if exists p_events_insert on public.social_events;
create policy p_events_insert on public.social_events for insert to authenticated with check (true);
drop policy if exists p_events_admin on public.social_events;
create policy p_events_admin on public.social_events for all to authenticated
  using (public.is_pengelola() or created_by = auth.uid()) with check (public.is_pengelola() or created_by = auth.uid());

drop policy if exists p_reg_read on public.event_registrations;
create policy p_reg_read on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists p_reg_own on public.event_registrations;
create policy p_reg_own on public.event_registrations for all to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

-- ---- cerita: publik hanya yang disetujui ----
drop policy if exists p_stories_read on public.stories;
create policy p_stories_read on public.stories for select to anon, authenticated
  using (is_published or author_id = auth.uid() or public.is_admin());
drop policy if exists p_stories_insert on public.stories;
create policy p_stories_insert on public.stories for insert to authenticated
  with check (author_id = auth.uid() and status = 'menunggu_review');
drop policy if exists p_stories_admin on public.stories;
create policy p_stories_admin on public.stories for all to authenticated
  using (public.is_pengelola() or author_id = auth.uid()) with check (public.is_pengelola() or author_id = auth.uid());

-- ---- notifikasi: milik pengguna ----
drop policy if exists p_notif_read on public.notifications;
create policy p_notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
drop policy if exists p_notif_update on public.notifications;
create policy p_notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists p_notif_admin on public.notifications;
create policy p_notif_admin on public.notifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- log: hanya admin, hanya bisa dibaca (tidak bisa diubah pengguna) ----
drop policy if exists p_vlogs_read on public.verification_logs;
create policy p_vlogs_read on public.verification_logs for select to authenticated using (public.is_admin());
drop policy if exists p_alogs_read on public.audit_logs;
create policy p_alogs_read on public.audit_logs for select to authenticated using (public.is_admin());

-- ============================================================
-- BAGIAN 16 — VIEW TRANSPARANSI (tanpa data pribadi)
-- ============================================================
-- identitas penerima disamarkan; tanpa alamat lengkap/rekening/dokumen
create or replace view public.v_proyek_transparansi as
select
  r.id,
  r.code,
  r.title,
  r.category_code,
  r.sub_category,
  r.city,
  r.province,
  r.amount_needed,
  r.funds_collected,
  r.funds_distributed,
  r.status,
  r.published_at,
  r.completed_at,
  case when p.full_name is null then 'Warga Bantu'
       else split_part(p.full_name, ' ', 1) || ' ' || left(split_part(p.full_name, ' ', 2), 1) || '***'
  end as penerima_samaran,
  (select full_name from public.profiles a where a.id = r.verified_by) as pengelola
from public.assistance_requests r
left join public.profiles p on p.id = r.user_id
where r.is_public and r.status in ('dipublikasikan','sedang_dibantu','bantuan_terpenuhi','selesai');

grant select on public.v_proyek_transparansi to anon, authenticated;

create or replace view public.v_penyaluran_publik as
select d.id, d.request_id, d.type, d.amount, d.item_description, d.distributed_at, r.code
from public.assistance_distributions d
join public.assistance_requests r on r.id = d.request_id
where r.is_public;

grant select on public.v_penyaluran_publik to anon, authenticated;

-- statistik platform untuk beranda & admin (aman dibaca publik)
create or replace function public.platform_stats() returns json
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total_pengguna',       (select count(*) from public.profiles),
    'total_pengajuan',      (select count(*) from public.assistance_requests),
    'total_tersalur',       (select count(*) from public.assistance_requests where status in ('sedang_dibantu','bantuan_terpenuhi','selesai')),
    'total_dana_terkumpul', (select coalesce(sum(funds_collected),0)  from public.assistance_requests),
    'total_dana_tersalur',  (select coalesce(sum(funds_distributed),0) from public.assistance_requests),
    'total_volunteer',      (select count(*) from public.volunteers where is_active),
    'total_komunitas',      (select count(*) from public.communities where is_active)
  )::json;
$$;
grant execute on function public.platform_stats() to anon, authenticated;

-- ============================================================
-- BAGIAN 17 — STORAGE BUCKETS (foto profil, bukti dokumen, dll)
-- ============================================================
insert into storage.buckets (id, name, public) values
  ('foto-profil',     'foto-profil',     true),
  ('bukti-dokumen',   'bukti-dokumen',   true),
  ('bukti-distribusi','bukti-distribusi',true),
  ('foto-cerita',     'foto-cerita',     true)
on conflict (id) do nothing;

drop policy if exists "sb_baca_publik" on storage.objects;
create policy "sb_baca_publik" on storage.objects for select to anon, authenticated
  using (bucket_id in ('foto-profil','bukti-dokumen','bukti-distribusi','foto-cerita'));

drop policy if exists "sb_upload_terautentikasi" on storage.objects;
create policy "sb_upload_terautentikasi" on storage.objects for insert to authenticated
  with check (bucket_id in ('foto-profil','bukti-dokumen','bukti-distribusi','foto-cerita')
              and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "sb_hapus_milik_sendiri" on storage.objects;
create policy "sb_hapus_milik_sendiri" on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin());

-- ============================================================
-- BAGIAN 18 — DATA AWAL (SEED)
-- ============================================================
insert into public.roles (name, description) values
  ('admin',     'Pengelola platform: verifikasi pengajuan, konfirmasi donasi, kelola konten'),
  ('penerima',  'Pemohon bantuan: membuat & memantau pengajuan bantuan'),
  ('donatur',   'Pemberi bantuan: donasi finansial, barang, tenaga, keahlian, jaringan'),
  ('volunteer', 'Relawan: mengikuti kegiatan bantuan tenaga & keahlian')
on conflict (name) do nothing;

insert into public.assistance_categories (code, name, icon, color, description, sub_items) values
  ('sosial',     'Bantuan Sosial',        'users',     'hijau',
   'Bantu keluarga prasejahtera, korban bencana, anak yatim & dhuafa.',
   '["Keluarga Prasejahtera","Kebutuhan Hidup Sehari-hari","Biaya Pendidikan Anak","Kebutuhan Sekolah Anak","Korban Bencana Alam","Anak Yatim & Dhuafa"]'::jsonb),
  ('kesehatan',  'Bantuan Kesehatan',     'heart',     'merah',
   'Biaya pengobatan, kebutuhan medis, donor darah, pendampingan pasien.',
   '["Biaya Pengobatan","Kebutuhan Medis","Transportasi Pasien","Informasi Donor Darah","Pendampingan Pasien"]'::jsonb),
  ('pendidikan', 'Bantuan Pendidikan',    'book',      'biru',
   'Beasiswa, buku, alat sekolah, guru volunteer, bimbingan gratis.',
   '["Beasiswa Pendidikan","Buku Pelajaran","Alat Tulis Sekolah","Guru Volunteer","Bimbingan Belajar Gratis"]'::jsonb),
  ('tenaga_jasa','Bantuan Tenaga & Jasa', 'tool',      'oranye',
   'Aksi volunteer, perbaikan rumah, konsultasi, keahlian profesional.',
   '["Aksi Volunteer","Perbaikan Rumah","Tenaga Bantu Harian","Konsultasi Gratis","Keahlian Profesional"]'::jsonb),
  ('barang',     'Bantuan Barang',        'package',   'ungu',
   'Pakaian, sembako, peralatan rumah, alat belajar, kebutuhan bayi.',
   '["Pakaian Layak","Makanan & Sembako","Peralatan Rumah Tangga","Alat Belajar","Kebutuhan Bayi"]'::jsonb),
  ('usaha',      'Bantuan Usaha',         'briefcase', 'teal',
   'Dukungan UMKM, pelatihan keterampilan, pemasaran, mentoring, kemitraan.',
   '["Dukungan Modal UMKM","Pelatihan Keterampilan","Bantuan Pemasaran","Mentoring Bisnis","Kemitraan Usaha"]'::jsonb)
on conflict (code) do nothing;

-- cerita pembuka (publik)
insert into public.stories (author_name, title, content, category_code, status, is_published, created_at) values
  ('Tim Saling Bantu',
   'Dari Penerima Menjadi Pemberi',
   'Dua tahun lalu Ibu Ratna menerima bantuan biaya pengobatan untuk anaknya melalui platform ini. Kini, setiap akhir pekan, ia menjadi relawan dapur bersama di komunitasnya. "Dulu saya yang dibantu. Sekali seumur hidup merasakan kebaikan orang, susah untuk tidak membantu balik," katanya sambil menyendok sup panas untuk warga.',
   'kesehatan', 'disetujui', true, now() - interval '9 days'),
  ('Tim Saling Bantu',
   'Ketika 23 Warga Berpakat Memperbaiki Satu Rumah',
   'Atap bocor Pak Hasan sudah dua musim hujan. Lewat fitur Bantuan Tenaga & Jasa, 23 warga dan 4 tukang berpakat datang di hari Minggu. Siangnya atap selesai, sorenya panggung rumah diganti. Yang paling mahal bukan bahannya, tapi jumlah tangan yang bersedia datang.',
   'tenaga_jasa', 'disetujui', true, now() - interval '15 days'),
  ('Tim Saling Bantu',
   'Buku Bekas, Harapan Baru',
   'Galeri tukar buku komunitas Peduli Nusantara mengumpulkan 1.240 buku dalam tiga minggu. Buku-buku itu kini mengisi perpustakaan mini di tiga desa. Anak-anak tidak hanya mendapat buku, tapi juga kakak pembimbing dari relawan guru yang mengajar setiap Sabtu.',
   'pendidikan', 'disetujui', true, now() - interval '21 days')
on conflict do nothing;

-- kegiatan pembuka
insert into public.social_events (title, description, event_type, category_code, location, event_date, quota, status) values
  ('Bersih Pantai & Bagi 100 Paket Sembako',
   'Bergabung bersama relawan membersihkan pantai dan menyerahkan 100 paket sembako untuk warga nelayan prasejahtera.',
   'volunteer', 'sosial', 'Pantai Cemara, Bantul, Yogyakarta', now() + interval '12 days', 50, 'terjadwal'),
  ('Kelas Belajar Gratis Akhir Pekan',
   'Mengajar membaca, berhitung, dan bahasa Inggris dasar untuk anak-anak pesisir. Cocok untuk relawan pelajar & mahasiswa.',
   'volunteer', 'pendidikan', 'SDN 3 Cemarasekar', now() + interval '8 days', 15, 'terjadwal'),
  ('Donor Darah Bersama Komunitas',
   'Donor darah rutin tiga bulanan bersama bank darah setempat. Pendaftar mendapat sertifikat donor & snack sehat.',
   'komunitas', 'kesehatan', 'Aula Kecamatan', now() + interval '17 days', 100, 'terjadwal')
on conflict do nothing;

-- komunitas pembuka
insert into public.communities (name, slug, description, city, member_count) values
  ('Sahabat Bandung Berbagi', 'sahabat-bandung-berbagi',
   'Komunitas warga Bandung yang rutin berbagi sembako, kelas belajar, dan aksi sosial bulanan.',
   'Bandung', 0),
  ('Peduli Nusantara', 'peduli-nusantara',
   'Jejaring komunitas lintas kota untuk respons cepat bencana dan pendidikan desa.',
   'Jakarta', 0)
on conflict (name) do nothing;

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
-- 19d-lanjutan: tabel pendukung agar seluruh menu ikut realtime
-- (fitur hapus data + pembaruan otomatis, sql/update_delete_realtime.sql)
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

-- ============================================================
-- SELESAI.
-- Setelah mendaftar dari aplikasi, jadikan admin dengan:
--   update public.profiles set role='admin', is_verified=true
--   where id = (select id from auth.users where email='emailkamu@mail.com');
-- ============================================================

-- ============================================================
-- BAGIAN 20 — MODUL ZISWAF
-- ============================================================

-- 20a. Pastikan role pengelola & helper is_pengelola tersedia
--      (idempotent — aman walau update_cms_realtime.sql belum jalan)
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

-- 20b. Tipe enum ZISWAF
do $$ begin
  create type ziswaf_jenis as enum ('zakat','infaq','sedekah','wakaf');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ziswaf_kelompok as enum ('siswa','guru','ortu_santri','umum');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ziswaf_bentuk as enum ('uang','barang');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ziswaf_status as enum ('menunggu','terverifikasi','ditolak');
exception when duplicate_object then null; end $$;

create sequence if not exists ziswaf_tx_seq  start 1;
create sequence if not exists ziswaf_sal_seq start 1;

-- 20c. Tabel penerimaan ZISWAF
create table if not exists public.ziswaf_transactions (
  id               uuid primary key default gen_random_uuid(),
  kode             text unique,                        -- ZW-2026-0001
  jenis            ziswaf_jenis not null,
  program          text not null default '',           -- Zakat Penghasilan, Beasiswa Yatim, ...
  kelompok         ziswaf_kelompok not null default 'umum',
  kelas            text not null default '',           -- khusus kelompok siswa
  donor_id         uuid references public.profiles(id) on delete cascade, -- boleh kosong: donatur tunai tanpa akun (siswa/umum)
  donor_name       text not null default '',
  is_anonymous     boolean not null default false,
  bentuk           ziswaf_bentuk not null default 'uang',
  jumlah           numeric(14,2) not null default 0 check (jumlah >= 0),
  item_description text not null default '',           -- rincian bila bentuk = barang
  metode           text not null default 'transfer_bank', -- transfer_bank | tunai | qris
  status           ziswaf_status not null default 'menunggu',
  note             text not null default '',
  verified_by      uuid references public.profiles(id),
  verified_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- 20d. Tabel penyaluran ZISWAF
create table if not exists public.ziswaf_distributions (
  id              uuid primary key default gen_random_uuid(),
  kode            text unique,                        -- ZS-2026-0001
  jenis           ziswaf_jenis not null,
  mustahik        text not null,                      -- kode kategori mustahik (8 asnaf + program)
  penerima        text not null default '',           -- golongan/instansi (bukan data pribadi)
  recipient_count integer not null default 0,
  bentuk          text not null default 'Uang',
  amount          numeric(14,2) not null default 0 check (amount >= 0),
  note            text not null default '',
  distributed_by  uuid references public.profiles(id),
  distributed_at  timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists idx_ziswaf_tx_status  on public.ziswaf_transactions (status, created_at desc);
create index if not exists idx_ziswaf_tx_donor   on public.ziswaf_transactions (donor_id);
create index if not exists idx_ziswaf_sal_jenis  on public.ziswaf_distributions (jenis, distributed_at desc);

-- 20e. Kode otomatis + isi nama pemberi
--      Anti-bentrok: nomor diambil dari counter, tetapi SELALU dibandingkan
--      dengan nomor terbesar yang sudah terpakai di tabel. Bila masih
--      bertabrakan, nomor dinaikkan sampai menemukan kode yang bebas.
--      (Mencegah error "duplicate key ... ziswaf_transactions_kode_key".)
create or replace function public.fn_ziswaf_tx_code() returns trigger
language plpgsql as $$
declare
  n int;
  k text;
begin
  if new.kode is null or new.kode = '' then
    n := greatest(
      nextval('ziswaf_tx_seq'),
      coalesce((select max(substring(t.kode from '[0-9]+$')::bigint)
                from public.ziswaf_transactions t
                where t.kode like 'ZW-%'), 0) + 1
    );
    k := 'ZW-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
    while exists (select 1 from public.ziswaf_transactions x where x.kode = k) loop
      n := n + 1;
      k := 'ZW-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
    end loop;
    perform setval('ziswaf_tx_seq', n);
    new.kode := k;
  end if;
  if new.donor_name = '' and new.donor_id is not null then
    select full_name into new.donor_name from public.profiles where id = new.donor_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_ziswaf_tx_code on public.ziswaf_transactions;
create trigger trg_ziswaf_tx_code before insert on public.ziswaf_transactions
for each row execute function public.fn_ziswaf_tx_code();

create or replace function public.fn_ziswaf_sal_code() returns trigger
language plpgsql as $$
declare
  n int;
  k text;
begin
  if new.kode is null or new.kode = '' then
    n := greatest(
      nextval('ziswaf_sal_seq'),
      coalesce((select max(substring(x.kode from '[0-9]+$')::bigint)
                from public.ziswaf_distributions x
                where x.kode like 'ZS-%'), 0) + 1
    );
    k := 'ZS-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
    while exists (select 1 from public.ziswaf_distributions x where x.kode = k) loop
      n := n + 1;
      k := 'ZS-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 4, '0');
    end loop;
    perform setval('ziswaf_sal_seq', n);
    new.kode := k;
  end if;
  return new;
end $$;
drop trigger if exists trg_ziswaf_sal_code on public.ziswaf_distributions;
create trigger trg_ziswaf_sal_code before insert on public.ziswaf_distributions
for each row execute function public.fn_ziswaf_sal_code();

-- 20f. Trigger penerimaan: audit + notifikasi
create or replace function public.fn_ziswaf_tx_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform public.fn_audit(new.donor_id, 'create', 'ziswaf_transactions', new.id,
    jsonb_build_object('kode', new.kode, 'jenis', new.jenis, 'kelompok', new.kelompok, 'jumlah', new.jumlah));
  for r in select id from public.profiles where role::text in ('admin','pengelola') and is_active loop
    perform public.fn_notify(r.id, 'donasi_tercatat', 'ZISWAF baru menunggu verifikasi',
      new.kode || ' — ' || new.jenis::text || ' dari ' || new.donor_name || ' menunggu verifikasi.',
      'admin.html#ziswaf');
  end loop;
  perform public.fn_notify(new.donor_id, 'donasi_tercatat', 'Niat ZISWAF tercatat',
    'Terima kasih! ' || new.kode || ' sedang menunggu verifikasi pengelola ZISWAF.',
    'dashboard.html#ziswaf');
  return new;
end $$;
drop trigger if exists trg_ziswaf_tx_created on public.ziswaf_transactions;
create trigger trg_ziswaf_tx_created after insert on public.ziswaf_transactions
for each row execute function public.fn_ziswaf_tx_created();

create or replace function public.fn_ziswaf_tx_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status then
    perform public.fn_audit(auth.uid(), 'update_status', 'ziswaf_transactions', new.id,
      jsonb_build_object('kode', new.kode, 'dari', old.status, 'ke', new.status));
    perform public.fn_notify(new.donor_id, 'donasi_tercatat',
      case when new.status = 'terverifikasi' then 'ZISWAF Anda terverifikasi' else 'ZISWAF ditolak' end,
      case when new.status = 'terverifikasi'
        then 'Terima kasih! ' || new.kode || ' (' || new.jenis::text || ') telah terverifikasi dan siap disalurkan.'
        else new.kode || ' tidak lolos verifikasi. Hubungi pengelola ZISWAF untuk info lebih lanjut.' end,
      'dashboard.html#ziswaf');
  else
    perform public.fn_audit(auth.uid(), 'update', 'ziswaf_transactions', new.id,
      jsonb_build_object('kode', new.kode));
  end if;
  return new;
end $$;
drop trigger if exists trg_ziswaf_tx_updated on public.ziswaf_transactions;
create trigger trg_ziswaf_tx_updated after update on public.ziswaf_transactions
for each row execute function public.fn_ziswaf_tx_updated();

-- 20g. Trigger penyaluran: audit
create or replace function public.fn_ziswaf_sal_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.fn_audit(new.distributed_by, 'create', 'ziswaf_distributions', new.id,
    jsonb_build_object('kode', new.kode, 'jenis', new.jenis, 'mustahik', new.mustahik, 'amount', new.amount));
  return new;
end $$;
drop trigger if exists trg_ziswaf_sal_created on public.ziswaf_distributions;
create trigger trg_ziswaf_sal_created after insert on public.ziswaf_distributions
for each row execute function public.fn_ziswaf_sal_created();

create or replace function public.fn_ziswaf_sal_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.fn_audit(auth.uid(), 'update', 'ziswaf_distributions', new.id,
    jsonb_build_object('kode', new.kode, 'mustahik', new.mustahik, 'amount', new.amount));
  return new;
end $$;
drop trigger if exists trg_ziswaf_sal_updated on public.ziswaf_distributions;
create trigger trg_ziswaf_sal_updated after update on public.ziswaf_distributions
for each row execute function public.fn_ziswaf_sal_updated();

-- 20h. Row Level Security
alter table public.ziswaf_transactions  enable row level security;
alter table public.ziswaf_distributions enable row level security;

-- penerimaan: pemberi melihat miliknya, pengelola melihat semua
drop policy if exists p_ziswaf_tx_read on public.ziswaf_transactions;
create policy p_ziswaf_tx_read on public.ziswaf_transactions for select to authenticated
  using (donor_id = auth.uid() or public.is_pengelola());

-- pemberi hanya bisa MENGAJUKAN (bukan mengubah status)
drop policy if exists p_ziswaf_tx_insert on public.ziswaf_transactions;
create policy p_ziswaf_tx_insert on public.ziswaf_transactions for insert to authenticated
  with check (donor_id = auth.uid() or public.is_pengelola()); -- pengelola mencatat donatur offline

-- verifikasi & edit hanya admin/pengelola
drop policy if exists p_ziswaf_tx_admin on public.ziswaf_transactions;
create policy p_ziswaf_tx_admin on public.ziswaf_transactions for update to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());
drop policy if exists p_ziswaf_tx_delete on public.ziswaf_transactions;
create policy p_ziswaf_tx_delete on public.ziswaf_transactions for delete to authenticated
  using (public.is_pengelola());

-- penyaluran: hanya pengelola yang menulis & membaca tabel;
-- publik membaca lewat view v_ziswaf_salur_publik
drop policy if exists p_ziswaf_sal_read on public.ziswaf_distributions;
drop policy if exists p_ziswaf_sal_admin on public.ziswaf_distributions;
create policy p_ziswaf_sal_admin on public.ziswaf_distributions for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- 20i. View publik tersanitasi (identitas anonim disamarkan)
create or replace view public.v_ziswaf_publik as
  select id, kode, jenis, program, kelompok, kelas,
    case when is_anonymous then 'Hamba Allah' else donor_name end as donor_nama,
    bentuk, jumlah, item_description, metode, created_at
  from public.ziswaf_transactions
  where status = 'terverifikasi';
grant select on public.v_ziswaf_publik to anon, authenticated;

create or replace view public.v_ziswaf_salur_publik as
  select id, kode, jenis, mustahik, penerima, recipient_count, bentuk, amount, note, distributed_at
  from public.ziswaf_distributions;
grant select on public.v_ziswaf_salur_publik to anon, authenticated;

-- 20j. Statistik ZISWAF (dipakai halaman publik & admin; aman via RLS-free rpc)
create or replace function public.ziswaf_stats() returns json
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'per_jenis', (
      select coalesce(jsonb_object_agg(j.jenis::text, jsonb_build_object(
        'terkumpul', j.terkumpul, 'tersalur', j.tersalur, 'saldo', j.terkumpul - j.tersalur, 'jumlah', j.jumlah
      )), '{}'::jsonb) from (
        select g.jenis,
          coalesce((select sum(t.jumlah) from public.ziswaf_transactions t
                    where t.jenis = g.jenis and t.status = 'terverifikasi'), 0) as terkumpul,
          coalesce((select sum(d.amount) from public.ziswaf_distributions d
                    where d.jenis = g.jenis), 0) as tersalur,
          coalesce((select count(*) from public.ziswaf_transactions t
                    where t.jenis = g.jenis and t.status = 'terverifikasi'), 0) as jumlah
        from (select unnest(enum_range(null::ziswaf_jenis)) as jenis) g
      ) j),
    'per_kelompok', (
      select coalesce(jsonb_object_agg(k.kelompok::text, jsonb_build_object(
        'terkumpul', k.terkumpul, 'jumlah', k.jumlah
      )), '{}'::jsonb) from (
        select g.kelompok,
          coalesce((select sum(t.jumlah) from public.ziswaf_transactions t
                    where t.kelompok = g.kelompok and t.status = 'terverifikasi'), 0) as terkumpul,
          coalesce((select count(*) from public.ziswaf_transactions t
                    where t.kelompok = g.kelompok and t.status = 'terverifikasi'), 0) as jumlah
        from (select unnest(enum_range(null::ziswaf_kelompok)) as kelompok) g
      ) k),
    'total_terkumpul',  coalesce((select sum(jumlah) from public.ziswaf_transactions where status = 'terverifikasi'), 0),
    'total_tersalur',   coalesce((select sum(amount) from public.ziswaf_distributions), 0),
    'jumlah_menunggu',  (select count(*) from public.ziswaf_transactions where status = 'menunggu'),
    'jumlah_transaksi', (select count(*) from public.ziswaf_transactions)
  )::json;
$$;
grant execute on function public.ziswaf_stats() to anon, authenticated;

-- 20k. Realtime: ikutkan tabel ZISWAF ke publication
do $$ begin
  alter publication supabase_realtime add table public.ziswaf_transactions;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.ziswaf_distributions;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- 20l. Data awal (seed) — contoh transaksi sekolah/yayasan
insert into public.ziswaf_transactions (kode, jenis, program, kelompok, kelas, donor_id, donor_name, is_anonymous, bentuk, jumlah, item_description, metode, status, note, created_at)
select 'ZW-2026-0001','zakat','Zakat Penghasilan','guru','', p.id, p.full_name, false, 'uang', 750000, '', 'transfer_bank', 'terverifikasi', 'Zakat penghasilan bulan Ramadan.', now() - interval '8 months'
from public.profiles p where p.role::text in ('admin','pengelola') order by p.created_at limit 1
on conflict (kode) do nothing;

insert into public.ziswaf_transactions (kode, jenis, program, kelompok, kelas, donor_id, donor_name, is_anonymous, bentuk, jumlah, item_description, metode, status, note, created_at) values
  ('ZW-2026-0002','zakat','Zakat Maal','siswa','8A', (select id from public.profiles where role::text='admin' limit 1), 'Rizky Ramadhan', false, 'uang', 50000, '', 'tunai', 'terverifikasi', 'Dari tabungan jajan sebulan.', now() - interval '8 months'),
  ('ZW-2026-0003','infaq','Kotak Amal','ortu_santri','7B', (select id from public.profiles where role::text='admin' limit 1), 'Ibu Fatimah Zahra', false, 'uang', 200000, '', 'transfer_bank', 'terverifikasi', 'Infaq rutin tiap Jumat.', now() - interval '7 months'),
  ('ZW-2026-0004','sedekah','Beasiswa Yatim','umum','', (select id from public.profiles where role::text='admin' limit 1), 'Hamba Allah', true, 'uang', 500000, '', 'qris', 'terverifikasi', 'Untuk adik-adik yatim.', now() - interval '7 months'),
  ('ZW-2026-0005','wakaf','Wakaf Pembangunan','ortu_santri','9A', (select id from public.profiles where role::text='admin' limit 1), 'Keluarga H. Mahmud', false, 'uang', 1000000, '', 'transfer_bank', 'terverifikasi', 'Wakaf tahap pembangunan laboratorium.', now() - interval '7 months'),
  ('ZW-2026-0006','sedekah','Santunan Dhuafa','guru','', (select id from public.profiles where role::text='admin' limit 1), 'Budi Santoso', false, 'uang', 250000, '', 'qris', 'terverifikasi', '', now() - interval '7 months'),
  ('ZW-2026-0007','zakat','Zakat Fitrah (Uang)','siswa','9C', (select id from public.profiles where role::text='admin' limit 1), 'Aisyah Nur Fadilah', false, 'uang', 35000, '', 'tunai', 'menunggu', 'Disetor lewat bendahara kelas.', now() - interval '2 days'),
  ('ZW-2026-0008','infaq','Infaq Masjid Sekolah','umum','', (select id from public.profiles where role::text='admin' limit 1), 'Pak Hendra Wijaya', false, 'barang', 0, '2 lusin buku ibadah & 1 karpet sajadah bekas layak', 'tunai', 'menunggu', 'Diambil ke rumah yayasan.', now() - interval '1 day')
on conflict (kode) do nothing;

insert into public.ziswaf_distributions (kode, jenis, mustahik, penerima, recipient_count, bentuk, amount, note, distributed_at) values
  ('ZS-2026-0001','zakat','miskin','20 KK warga sekitar sekolah', 20, 'Sembako & bahan makanan pokok', 500000, 'Disalurkan menjelang Ramadan bersama guru & siswa OSIS.', now() - interval '8 months' + interval '4 days'),
  ('ZS-2026-0002','sedekah','beasiswa','12 siswa yatim & dhuafa', 12, 'Paket alat tulis + seragam', 350000, 'Penyaluran awal semester.', now() - interval '7 months' + interval '3 days'),
  ('ZS-2026-0003','infaq','operasional','Masjid sekolah', 1, 'Uang operasional (listrik, air, kebersihan)', 150000, 'Tagihan bulan berjalan.', now() - interval '7 months' + interval '16 days')
on conflict (kode) do nothing;

-- 20m. Selaraskan ulang counter dengan kode yang sudah terpakai.
--      WAJIB: data contoh di atas memakai kode ZW-2026-0001..0008 dan
--      ZS-2026-0001..0003 secara langsung tanpa menyentuh counter. Tanpa
--      langkah ini, transaksi nyata pertama mendapat nomor 1 lagi dan gagal
--      dengan "duplicate key value violates unique constraint ..._kode_key".
select setval('ziswaf_tx_seq',
  greatest((select coalesce(max(substring(kode from '[0-9]+$')::bigint), 0)
            from public.ziswaf_transactions where kode like 'ZW-%'), 0) + 1,
  false);
select setval('ziswaf_sal_seq',
  greatest((select coalesce(max(substring(kode from '[0-9]+$')::bigint), 0)
            from public.ziswaf_distributions where kode like 'ZS-%'), 0) + 1,
  false);

-- ============================================================
-- BAGIAN 21 — MODUL GALERI FOTO
-- Galeri foto program & kegiatan: publik melihat foto aktif,
-- admin/pengelola mengelola (tambah/ubah/arsip/hapus) lewat
-- Panel Admin -> Galeri Kegiatan. Ikut Realtime.
-- ============================================================

-- 21a. Tabel galeri foto
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

-- 21b. Keamanan (RLS): publik boleh melihat semua foto aktif,
--      admin/pengelola memegang kendali penuh
alter table public.gallery_photos enable row level security;

drop policy if exists p_gallery_read on public.gallery_photos;
create policy p_gallery_read on public.gallery_photos for select to anon, authenticated
  using (true);

drop policy if exists p_gallery_admin on public.gallery_photos;
create policy p_gallery_admin on public.gallery_photos for all to authenticated
  using (public.is_pengelola()) with check (public.is_pengelola());

-- 21c. Realtime: ikutkan galeri ke publication supabase_realtime
do $$ begin
  alter publication supabase_realtime add table public.gallery_photos;
exception when duplicate_object then null; end $$;
