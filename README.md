# HUMS Student Portal

The portal uses Supabase Auth and a shared Supabase database. Student accounts
are issued by an administrator with a Student ID and password, and can sign in
from any device. Student passwords are held by Supabase Auth; they are never
stored in the student record JSON.

## Supabase setup

1. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL` to the project's URL.
   - `VITE_SUPABASE_ANON_KEY` to the project's public anon/publishable key.
   - `VITE_ADMIN_LOGIN_EMAIL` to the administrator's Supabase Auth email.
2. Apply `supabase/migrations/20261015000000_shared_portal_database.sql` in the
   Supabase SQL Editor.
3. Create the administrator account in Supabase Auth, then grant it portal
   administrator access in the SQL Editor:

   ```sql
   insert into public.portal_admins (user_id, username)
   select id, 'admin'
   from auth.users
   where lower(email) = lower('ADMIN_EMAIL_HERE')
   on conflict (user_id) do update set username = excluded.username;
   ```

4. Deploy both Supabase Edge Functions from the repository root:

   ```powershell
   supabase functions deploy create-student
   supabase functions deploy delete-student
   ```

   The functions use Supabase's server-side `SUPABASE_SERVICE_ROLE_KEY`. Never
   put that key in `.env.local`, frontend code, or a public repository.
5. In Supabase Auth URL Configuration, set the Site URL to your deployed
   website's `/admin-reset-password` page and add that URL plus
   `http://localhost:5173/admin-reset-password` to the allowed redirect URLs.
   The admin sign-in page can send the recovery email. Emails sent from the
   Supabase dashboard should use the same reset page as their redirect.
6. Restart Vite after changing environment variables:

   ```powershell
   npm run dev
   ```

The first admin sign-in can import records already in that browser into an
empty shared database. The import creates Supabase Auth accounts for students
and requires each student's initial password to be at least 8 characters.
After that, changes to students, scores, teachers, classes, announcements, and
schedules are shared across devices. Existing records in another browser are
not automatically discovered; import from the browser that currently holds
the source data.

## Development

```powershell
npm install
npm run dev
npm run lint
npm run build
```
