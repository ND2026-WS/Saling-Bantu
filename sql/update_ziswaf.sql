-- ============================================================
-- SALING BANTU — PEMBARUAN DATABASE: MODUL ZISWAF
-- (untuk database yang SUDAH pernah menjalankan
--  supabase_schema.sql + update_cms_realtime.sql sebelumnya)
-- ------------------------------------------------------------
-- Fitur baru: pengelolaan ZISWAF (Zakat, Infaq, Sedekah, Wakaf)
--   - Penerimaan dari siswa, guru & tendik, orang tua santri, umum
--   - Verifikasi oleh admin/pengelola (saldo dana otomatis)
--   - Penyaluran ke mustahik (8 asnaf + program yayasan)
--   - Fungsi statistik ziswaf_stats() untuk transparansi publik
--
-- PEMBARUAN v2 (PENTING — wajib dijalankan ulang bila versi lama sudah jalan):
--   Memperbaiki error "duplicate key value violates unique constraint
--   ziswaf_transactions_kode_key". Penyebab: data contoh memakai kode
--   ZW-2026-0001..0008 tanpa menggeser counter, sehingga transaksi nyata
--   pertama mendapat nomor 1 lagi dan menabrak kode yang sudah ada.
--   Versi baru: trigger kode anti-bentrok + counter diselaraskan otomatis.
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query ->
--   tempel seluruh isi file ini -> Run.
-- (Database baru tidak butuh file ini; cukup supabase_schema.sql
--  yang sudah memuat BAGIAN 20 yang sama.)
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

-- pemberi hanya bisa MENGAJUKAN (bukan mengubah status);
-- pengelola/admin boleh mencatat ZISWAF atas nama donatur offline tanpa akun
drop policy if exists p_ziswaf_tx_insert on public.ziswaf_transactions;
create policy p_ziswaf_tx_insert on public.ziswaf_transactions for insert to authenticated
  with check (donor_id = auth.uid() or public.is_pengelola());

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
