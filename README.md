# MOHIT CAREERX — Real Job Portal

This is a Supabase-backed job portal with:
- Email/password signup and login
- PostgreSQL database
- Public active job listings
- Job search + category filter
- Save jobs
- Apply/track applications
- Candidate dashboard
- Admin dashboard for adding/editing/deleting/publishing jobs
- Row Level Security (RLS)

## IMPORTANT: Run locally through localhost

Do NOT open `index.html` or `admin.html` by double-clicking them. That uses the `file://` protocol and can cause authentication/session problems.

### Easiest Windows method

1. Double-click `start_portal.bat`.
2. It starts a local server at `http://localhost:8000/` and opens the portal.
3. Keep the black Command Prompt window open while using the portal.
4. Close that window when you are finished.

If Python is not installed, install Python and run `start_portal.bat` again.

## Supabase setup

1. Create a Supabase project.
2. In SQL Editor, paste and Run the entire `schema.sql` once.
3. Authentication → Sign In / Providers → Email should be enabled.
4. `supabase-config.js` contains the Project URL and browser-safe Publishable Key.
5. NEVER put a `sb_secret_*` or `service_role` key in browser code.

## Make your account an admin

After the account exists, run this in Supabase SQL Editor (replace the email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
```

Verify with:

```sql
select u.email, p.role
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

Your account should show `role = admin`.

## Use the Admin Dashboard

1. Start `start_portal.bat`.
2. Open `http://localhost:8000/login.html`.
3. Login with the admin account.
4. Open `http://localhost:8000/admin.html`.
5. Add a job and click **Save Job**.
6. Keep **Published / active** checked to show it on the public portal.

## Demo jobs

`schema.sql` adds demo jobs if the jobs table is empty. Replace or delete these before public launch.

## Production

For public hosting, GitHub Pages or another static host can serve the frontend. Use HTTPS and configure Supabase Auth redirect/site URLs for your final domain.

Important production checklist:
- Only publish verified job listings.
- Never expose Supabase secret/service-role keys.
- Keep RLS enabled.
- Replace demo `example.com` application links.
- Add Privacy Policy and Terms before collecting personal data at scale.
- If you add resume uploads, use a private Supabase Storage bucket with authenticated policies.
