# Gig Monkey Supabase Setup

## What to create in Supabase

1. Create a new Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](/Users/julianbetts/Documents/gig-monkey/supabase/schema.sql).
3. In Authentication, enable Email auth.
4. Choose whether Email Confirmations should stay on.
5. In Authentication -> URL Configuration, add your app URL as a site URL and redirect URL.
6. In Project Settings -> API, copy:
   - Project URL
   - Project API anon key
7. Put those values into [`supabase-config.js`](/Users/julianbetts/Documents/gig-monkey/supabase-config.js).

## Values to add locally

Edit [`supabase-config.js`](/Users/julianbetts/Documents/gig-monkey/supabase-config.js):

```js
window.GIG_MONKEY_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

The anon key is expected to be public in a browser app. Data protection comes from Row Level Security, which is already included in the SQL.

## What the SQL creates

- `profiles`
- `setlists`
- `setlist_songs`
- `practice_events`
- `gig_notes`
- `stage_plot_items`
- RLS policies that restrict every table to `auth.uid()`
- `handle_new_user()` trigger to create a profile row when a new auth user is created
- `get_user_workspace()` RPC to load the signed-in user's app data
- `save_user_workspace(workspace jsonb)` RPC to replace the signed-in user's workspace in one server-side call

## Data model mapping

- Profile info: `profiles`
- Setlists: `setlists`
- Setlist songs: `setlist_songs`
- Practice/schedule events: `practice_events`
- Gig notes: `gig_notes`
- Stage plot items: `stage_plot_items`

## Guest mode and migration

- Guest mode still uses browser local storage.
- When a guest signs up, the current local workspace is saved temporarily and copied into Supabase after the first authenticated session is available.
- If email confirmation is required, the local guest snapshot stays queued until the user confirms and logs in.
