-- CardVault initial Supabase schema

create extension if not exists "pgcrypto";

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  title text,
  company text,
  email text,
  phone text,
  website text,
  occasion text,
  date date,
  notes text,
  image_data text,
  front_image_path text,
  back_image_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists contacts_user_id_created_at_idx on public.contacts(user_id, created_at desc);
create index if not exists contacts_user_id_company_idx on public.contacts(user_id, company);
create index if not exists contacts_user_id_occasion_idx on public.contacts(user_id, occasion);

alter table public.contacts enable row level security;

create policy if not exists "contacts_select_own"
  on public.contacts
  for select
  using (auth.uid() = user_id);

create policy if not exists "contacts_insert_own"
  on public.contacts
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "contacts_update_own"
  on public.contacts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "contacts_delete_own"
  on public.contacts
  for delete
  using (auth.uid() = user_id);

create or replace function public.set_contacts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function public.set_contacts_updated_at();

insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

create policy if not exists "card_images_read_own"
  on storage.objects
  for select
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy if not exists "card_images_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy if not exists "card_images_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy if not exists "card_images_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'card-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
