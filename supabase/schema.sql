-- =============================================================================
-- Forge — database schema (Supabase / PostgreSQL)
--
-- Exported from the live Supabase project on 2026-10-20 (structure only, no data).
-- Run this once in a new Supabase project: Dashboard → SQL Editor → paste → Run.
--
-- Security model: every table has Row-Level Security enabled, and every policy
-- allows a row only when it belongs to the signed-in user (auth.uid()).
-- The app's publishable key is public on purpose; these policies are what
-- actually keep each user's data private.
--
-- `auth.users` and `auth.uid()` are provided by Supabase Auth.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- One row per user. `id` IS the auth user id (no separate generated id).
create table public.profiles (
  id uuid not null,
  email text,
  age integer,
  gender text,
  height numeric,
  current_weight numeric,
  target_weight numeric,
  activity_level text,
  fitness_goal text,
  daily_calorie_target integer,
  daily_protein_target integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  user_id uuid  -- legacy: from the first multi-user design; the app keys profiles by `id`
);

create table public.meals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  meal_category text not null,
  food_name text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  is_favorite boolean default false,  -- legacy: favorites now live in favorite_meals
  consumed_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Category-agnostic by design (no meal_category); the category is chosen when logging.
create table public.favorite_meals (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  calories numeric not null,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  created_at timestamp with time zone default now()
);

-- "Steps & daily movement" entries are stored here too: workout_type 'Other', duration 0.
create table public.workouts (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  workout_type text not null,
  duration_minutes integer,
  calories_burned numeric,
  heart_rate_avg integer,
  notes text,
  workout_date timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Sets of a strength workout (Gym / Bouldering).
create table public.exercise_logs (
  id uuid default gen_random_uuid() not null,
  workout_id uuid not null,
  exercise_name text not null,
  sets integer,
  reps integer,
  weight_kg numeric,
  notes text,
  created_at timestamp with time zone default now(),
  user_id uuid
);

-- One row per user per night (enforced by the unique constraint below).
create table public.sleep_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  sleep_hours numeric,      -- legacy: from the first, simpler sleep tracker
  quality_rating integer,   -- legacy
  log_date date default current_date,
  created_at timestamp with time zone default now(),
  total_asleep_minutes integer,
  awake_minutes integer,
  rem_minutes integer,
  core_minutes integer,
  deep_minutes integer,
  bedtime text,    -- "HH:MM"
  wake_time text   -- "HH:MM"
);

create table public.water_logs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  amount_ml numeric not null,
  log_date date default ((now() at time zone 'utc'::text))::date not null,
  created_at timestamp with time zone default now() not null
);


-- -----------------------------------------------------------------------------
-- Keys and relationships
-- Deleting a user (or a workout) cascades to everything that belongs to it.
-- -----------------------------------------------------------------------------

alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.profiles add constraint profiles_user_id_key unique (user_id);

alter table public.meals add constraint meals_pkey primary key (id);
alter table public.meals add constraint meals_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.favorite_meals add constraint favorite_meals_pkey primary key (id);
alter table public.favorite_meals add constraint favorite_meals_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.workouts add constraint workouts_pkey primary key (id);
alter table public.workouts add constraint workouts_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.exercise_logs add constraint exercise_logs_pkey primary key (id);
alter table public.exercise_logs add constraint exercise_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.exercise_logs add constraint exercise_logs_workout_id_fkey foreign key (workout_id) references public.workouts(id) on delete cascade;

alter table public.sleep_logs add constraint sleep_logs_pkey primary key (id);
alter table public.sleep_logs add constraint sleep_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.sleep_logs add constraint sleep_logs_user_date_key unique (user_id, log_date);

alter table public.water_logs add constraint water_logs_pkey primary key (id);
alter table public.water_logs add constraint water_logs_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;


-- -----------------------------------------------------------------------------
-- Indexes (every query in the app filters by user_id)
-- -----------------------------------------------------------------------------

create index profiles_user_id_idx       on public.profiles       using btree (user_id);
create index meals_user_id_idx          on public.meals          using btree (user_id);
create index favorite_meals_user_id_idx on public.favorite_meals using btree (user_id);
create index workouts_user_id_idx       on public.workouts       using btree (user_id);
create index exercise_logs_user_id_idx  on public.exercise_logs  using btree (user_id);
create index sleep_logs_user_id_idx     on public.sleep_logs     using btree (user_id);
create index water_logs_user_id_idx     on public.water_logs     using btree (user_id);
create index water_logs_log_date_idx    on public.water_logs     using btree (log_date);


-- -----------------------------------------------------------------------------
-- Row-Level Security
-- `using`      decides which existing rows a user can see / update / delete.
-- `with check` decides which rows a user is allowed to write.
-- Both require the row to belong to the signed-in user, so nobody can read
-- another user's data or insert rows under someone else's id.
-- -----------------------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.meals          enable row level security;
alter table public.favorite_meals enable row level security;
alter table public.workouts       enable row level security;
alter table public.exercise_logs  enable row level security;
alter table public.sleep_logs     enable row level security;
alter table public.water_logs     enable row level security;

create policy "Allow authenticated user full access to own profile" on public.profiles
  as permissive for all to authenticated
  using ((auth.uid() = id)) with check ((auth.uid() = id));

create policy "Users manage own meals" on public.meals
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users manage own favorite_meals" on public.favorite_meals
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users manage own workouts" on public.workouts
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users manage own exercise_logs" on public.exercise_logs
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users manage own sleep_logs" on public.sleep_logs
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

create policy "Users manage own water_logs" on public.water_logs
  as permissive for all to public
  using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
