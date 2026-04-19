-- Enums
create type public.task_priority as enum ('low','medium','high');
create type public.recurrence_type as enum ('none','daily','weekly');

-- Updated_at helper
create or replace function public.update_updated_at_column()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql set search_path = public;

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Profiles viewable by owner" on public.profiles for select using (auth.uid() = user_id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = user_id);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Tasks (definition; recurring or one-off)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  priority public.task_priority not null default 'medium',
  estimate_minutes integer not null default 30 check (estimate_minutes >= 0),
  recurrence public.recurrence_type not null default 'none',
  -- weekly: 0=Sunday..6=Saturday array; daily ignores; none ignores
  recurrence_days smallint[] not null default '{}',
  start_time time, -- optional time of day
  recurrence_start_date date,
  recurrence_end_date date,
  deadline timestamptz, -- for one-off tasks
  reminder_minutes integer, -- minutes before to remind (null = no reminder)
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_tasks_user on public.tasks(user_id);
alter table public.tasks enable row level security;
create policy "tasks select own" on public.tasks for select using (auth.uid() = user_id);
create policy "tasks insert own" on public.tasks for insert with check (auth.uid() = user_id);
create policy "tasks update own" on public.tasks for update using (auth.uid() = user_id);
create policy "tasks delete own" on public.tasks for delete using (auth.uid() = user_id);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.update_updated_at_column();

-- Task instances (one row per scheduled occurrence on a given date)
create table public.task_instances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  estimate_minutes integer not null default 30,
  is_done boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, scheduled_date)
);
create index idx_instances_user_date on public.task_instances(user_id, scheduled_date);
alter table public.task_instances enable row level security;
create policy "ti select own" on public.task_instances for select using (auth.uid() = user_id);
create policy "ti insert own" on public.task_instances for insert with check (auth.uid() = user_id);
create policy "ti update own" on public.task_instances for update using (auth.uid() = user_id);
create policy "ti delete own" on public.task_instances for delete using (auth.uid() = user_id);
create trigger ti_updated_at before update on public.task_instances
  for each row execute function public.update_updated_at_column();

-- Notifications inbox
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  task_id uuid references public.tasks(id) on delete set null,
  is_read boolean not null default false,
  remind_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_user on public.notifications(user_id, created_at desc);
alter table public.notifications enable row level security;
create policy "notif select own" on public.notifications for select using (auth.uid() = user_id);
create policy "notif insert own" on public.notifications for insert with check (auth.uid() = user_id);
create policy "notif update own" on public.notifications for update using (auth.uid() = user_id);
create policy "notif delete own" on public.notifications for delete using (auth.uid() = user_id);