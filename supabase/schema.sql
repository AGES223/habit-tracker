create table if not exists public.habits (
  id bigint primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 140),
  color text not null default '#1B4080',
  category text not null default 'Other',
  note text not null default '',
  weekdays_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habit_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id bigint not null references public.habits(id) on delete cascade,
  completed_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, habit_id, completed_on)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user_created_idx on public.habits (user_id, created_at);
create index if not exists habit_completions_user_day_idx
  on public.habit_completions (user_id, completed_on desc);

alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.profiles enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.habits to authenticated;
grant select, insert, delete on public.habit_completions to authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own habits" on public.habits;
create policy "Users can read their own habits"
on public.habits
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own habits" on public.habits;
create policy "Users can create their own habits"
on public.habits
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own habits" on public.habits;
create policy "Users can update their own habits"
on public.habits
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own habits" on public.habits;
create policy "Users can delete their own habits"
on public.habits
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their own completions" on public.habit_completions;
create policy "Users can read their own completions"
on public.habit_completions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own completions" on public.habit_completions;
create policy "Users can create their own completions"
on public.habit_completions
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.habits h
    where h.id = habit_id
      and h.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can delete their own completions" on public.habit_completions;
create policy "Users can delete their own completions"
on public.habit_completions
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists habits_set_updated_at on public.habits;
create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create schema if not exists private;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
