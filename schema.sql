-- MOHIT CAREERX — REAL JOB PORTAL + WEBSITE EDITOR
-- Run this entire file in Supabase SQL Editor.
-- IMPORTANT: If you already ran the older schema, this version is safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text,
  job_type text not null default 'Full-time',
  category text not null default 'IT Jobs',
  experience text,
  salary text,
  skills text,
  description text,
  apply_url text,
  is_remote boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_jobs (
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  full_name text,
  email text,
  resume_url text,
  cover_note text,
  status text not null default 'submitted' check (status in ('submitted','reviewing','shortlisted','rejected','hired')),
  created_at timestamptz not null default now(),
  unique (user_id, job_id)
);

-- Website Editor content
create table if not exists public.site_content (
  key text primary key,
  value text not null default '',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  youtube_url text not null,
  description text,
  thumbnail_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_photos (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  storage_path text,
  alt_text text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Profile auto-create on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.applications enable row level security;
alter table public.site_content enable row level security;
alter table public.site_videos enable row level security;
alter table public.site_photos enable row level security;

-- Profiles
 drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Jobs
 drop policy if exists "public_read_active_jobs" on public.jobs;
create policy "public_read_active_jobs" on public.jobs for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins_insert_jobs" on public.jobs;
create policy "admins_insert_jobs" on public.jobs for insert to authenticated with check (public.is_admin());
drop policy if exists "admins_update_jobs" on public.jobs;
create policy "admins_update_jobs" on public.jobs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins_delete_jobs" on public.jobs;
create policy "admins_delete_jobs" on public.jobs for delete to authenticated using (public.is_admin());

-- Saved jobs
 drop policy if exists "saved_jobs_own" on public.saved_jobs;
create policy "saved_jobs_own" on public.saved_jobs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Applications
 drop policy if exists "applications_own_or_admin_select" on public.applications;
create policy "applications_own_or_admin_select" on public.applications for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "applications_own_insert" on public.applications;
create policy "applications_own_insert" on public.applications for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "applications_own_update" on public.applications;
create policy "applications_own_update" on public.applications for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "applications_admin_delete" on public.applications;
create policy "applications_admin_delete" on public.applications for delete to authenticated using (public.is_admin());

-- Website Editor public read + admin write
 drop policy if exists "public_read_site_content" on public.site_content;
create policy "public_read_site_content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "admins_manage_site_content" on public.site_content;
create policy "admins_manage_site_content" on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public_read_active_site_videos" on public.site_videos;
create policy "public_read_active_site_videos" on public.site_videos for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins_manage_site_videos" on public.site_videos;
create policy "admins_manage_site_videos" on public.site_videos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public_read_active_site_photos" on public.site_photos;
create policy "public_read_active_site_photos" on public.site_photos for select to anon, authenticated using (is_active = true or public.is_admin());
drop policy if exists "admins_manage_site_photos" on public.site_photos;
create policy "admins_manage_site_photos" on public.site_photos for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Storage bucket for public website images. Do NOT use it for resumes/private documents.
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;

drop policy if exists "public_read_site_media" on storage.objects;
create policy "public_read_site_media" on storage.objects for select to anon, authenticated using (bucket_id = 'site-media');
drop policy if exists "admins_insert_site_media" on storage.objects;
create policy "admins_insert_site_media" on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "admins_update_site_media" on storage.objects;
create policy "admins_update_site_media" on storage.objects for update to authenticated using (bucket_id = 'site-media' and public.is_admin()) with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "admins_delete_site_media" on storage.objects;
create policy "admins_delete_site_media" on storage.objects for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());

-- Grants
grant select on public.jobs to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.saved_jobs to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.site_content to authenticated;
grant select, insert, update, delete on public.site_videos to authenticated;
grant select, insert, update, delete on public.site_photos to authenticated;

-- Default editable website content
insert into public.site_content (key,value) values
('site_name','MOHIT CAREERX'),
('hero_eyebrow','REAL JOB PORTAL • CAREER GROWTH'),
('hero_title','Find your next career opportunity.'),
('hero_text','Search jobs, learn practical IT skills, discover free certifications and grow your career with MOHIT CAREERX.'),
('career_title','Learn Skills • Get Jobs • Grow'),
('career_text','Excel • SQL • Power BI • Data Analytics • AI • Resume • Interview Preparation'),
('about_title','About MOHIT CAREERX'),
('about_text','MOHIT CAREERX helps students and job seekers with IT jobs, free certifications, data analytics, AI & tech careers, resume tips and interview preparation.'),
('contact_text','For collaborations, job submissions or career queries, contact MOHIT CAREERX.'),
('youtube_section_title','Latest YouTube Videos'),
('photos_section_title','Career & Learning Gallery')
on conflict (key) do nothing;

-- Demo jobs. Replace/delete them from Admin dashboard.
insert into public.jobs
(title, company, location, job_type, category, experience, salary, skills, description, apply_url, is_remote)
select * from (values
('Junior Data Analyst','MOHIT CAREERX Demo','India','Full-time','Data Analytics','0–1 year','₹3–6 LPA','Excel, SQL, Power BI','Demo listing — replace this with a verified opportunity before publishing.','https://example.com',true),
('IT Support Fresher','MOHIT CAREERX Demo','India','Full-time','IT Jobs','Fresher','₹2.5–4.5 LPA','Networking, Windows, Troubleshooting','Demo listing for testing the portal.','https://example.com',false),
('AI Tools Intern','MOHIT CAREERX Demo','Remote','Internship','AI & Tech','Student / Fresher','Stipend','AI tools, Automation, Prompting','Demo internship listing for testing.','https://example.com',true)
) as v(title,company,location,job_type,category,experience,salary,skills,description,apply_url,is_remote)
where not exists (select 1 from public.jobs);
