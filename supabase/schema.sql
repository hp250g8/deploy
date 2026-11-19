-- Hygienic Cart Loyalty Rewards — Supabase schema
-- Run this in Supabase Dashboard > SQL Editor > New query > Run.
-- It is safe to run once on a fresh project. It creates the tables,
-- the initial menu, and a settings row. It does NOT create any
-- customers — the app starts empty on purpose.
--
-- Row Level Security (RLS): this app is a single-owner shop app.
-- The owner PIN is checked in the app (hashed, never stored in plain
-- text). For a public deployment, enable RLS and add policies that
-- only allow the anon key to insert a purchase request and read its
-- own card, and put all owner writes behind a Supabase Auth login
-- or a small server API route. The notes at the bottom explain this.
-- Do NOT put the Supabase service-role key in the browser.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  member_id text not null unique,            -- HC-0001, HC-0002, ...
  full_name text not null,
  mobile text not null unique,               -- 10 digits, one card per mobile
  stamps int not null default 0,             -- stamps in the current cycle (0-10)
  total_approved int not null default 0,     -- approved purchases, all cycles
  completed_cards int not null default 0,    -- cycles finished (10 stamps reached)
  rewards_redeemed int not null default 0,
  reward_ready boolean not null default false,
  status text not null default 'active',     -- active | inactive
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  member_id text not null,
  customer_name text not null,
  mobile text not null,
  item_name text not null default 'Purchase at Hygienic Cart',
  menu_item_id uuid null,
  quantity int not null default 1,
  status text not null default 'pending',    -- pending | approved | declined
  reason text null,                          -- decline reason, if any
  decided_by text null default 'Owner',
  created_at timestamptz not null default now(),
  decided_at timestamptz null
);

-- One stamp per approved purchase, never per item. A customer can only
-- have one pending request at a time — this blocks duplicate requests.
create unique index if not exists transactions_one_pending_per_customer
  on transactions (customer_id) where status = 'pending';

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  member_id text not null,
  customer_name text not null,
  redeemed_at timestamptz not null default now(),
  redeemed_by text not null default 'Owner'
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price int not null,                        -- INR, whole rupees
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key default 1,
  pin_hash text null,                        -- SHA-256 hash of the owner PIN, never the PIN itself
  stamps_needed int not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists sms_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                        -- registration | approval_request | approved | declined | reward_ready | redeemed
  to_mobile text not null,
  message text not null,
  status text not null default 'not_configured', -- not_configured | sent | failed
  provider text null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,                      -- register | request | approve | decline | redeem | menu_change | pin_change
  detail text not null,
  member_id text null,
  created_at timestamptz not null default now()
);

-- Initial menu, as given in the project spec (Full prices).
-- The owner can edit these in Menu Management, including changing
-- them to the current Half / Full menu (Crispy, Crispy Cheese, etc.).
insert into menu_items (name, price) values
  ('Classic Vada Pav', 40),
  ('Cheese Vada Pav', 70),
  ('Ulta Vada Pav', 60),
  ('Shezwan Vada Pav', 60),
  ('Dabeli', 40),
  ('Pav Bhaji', 80),
  ('Combo (Classic Vada Pav + Dabeli)', 50)
on conflict do nothing;

insert into settings (id, pin_hash, stamps_needed)
values (1, null, 10)
on conflict (id) do nothing;

-- RLS notes (read before going live):
-- 1. Turn on RLS on every table in Supabase Dashboard > Authentication > Policies.
-- 2. This app uses the anon key from the browser, so keep policies tight:
--    customers: allow insert (registration) and select by mobile only;
--    transactions: allow insert (request a stamp), select own rows only;
--    menu_items: public read, no public write.
-- 3. Owner writes (approve / decline / redeem / menu edit) should go
--    through a server API route that checks the owner PIN, or through
--    Supabase Auth with an owner account. Do not use the service-role
--    key in the browser — anyone could read it and take over the app.
-- 4. Backups: Supabase Dashboard > Database > Backups (daily backups
--    are on paid plans; on the free plan, export with pg_dump regularly).
