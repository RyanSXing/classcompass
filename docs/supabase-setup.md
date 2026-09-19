# Supabase setup and verification

ClassCompass uses a dedicated Supabase project for connected mode. The application authenticates one pre-provisioned teacher and uses that teacher's JWT for every database and private-storage operation. `SUPABASE_SECRET_KEY` is only for deliberate local provisioning and integration verification; the running app does not use it.

## Provision and apply

Use the installed, authenticated Supabase CLI to select the dedicated ClassCompass project and apply the versioned migrations in `supabase/migrations`. Do not run these migrations against an unrelated existing app. From this repository:

```sh
supabase link --project-ref YOUR_CLASSCOMPASS_PROJECT_REF
supabase db push
```

The migration creates separate tables for students, batches, submissions, assets, extracted/effective responses, findings, observations, plan versions, proposals, materials, calendar entries, jobs and audit data. Each row has an owner and a stable identity. JSONB stores each bounded entity's fields; no table stores the complete application state. Generated foreign keys and indexes cover the relationships used by the app.

The repository's two RPCs reconstruct the owner-scoped state and commit changes atomically. The commit takes a per-owner advisory transaction lock and compares the expected revision. A concurrent or stale writer receives PostgREST `PT409` (HTTP 409); no partial record updates commit. Every nested entity must match the authenticated owner. Historical scans/extractions, plan versions, materials, corrections and audit records cannot be rewritten. Observations only allow a superseded marker to be appended; their original evidence and interpretation remain immutable. Existing records cannot be dropped from a subsequent state commit.

The CAS conflict uses `PT409` because PostgREST 14 retries custom `40001` serialization errors indefinitely; migration 003 applies this compatibility fix.

Both functions use `security invoker`, an empty search path, explicit `auth.uid()` checks, and table RLS. They are executable by authenticated teachers only. Tables have no anonymous grants and no authenticated delete grant. An owner may only read/write their own records; immutable-history triggers also apply to direct table updates.

The migration creates the private `classcompass-evidence` bucket. Paths start with the authenticated owner UUID, followed by server-generated asset identities. Allowed MIME types are PNG, JPEG, PDF and JSON, with a five-MiB object cap. RLS applies to uploads, downloads and signed URLs. The follow-up immutable-evidence migration removes the UPDATE policy, so existing objects cannot be replaced. A new source requires a new asset identity. The application still checks file signatures, decoded dimensions, page counts and hashes.

## Teacher account and environment

Pre-provision a teacher in Supabase Authentication, using an email/password or the local admin SDK. Public signup is not part of the application. Put the project values in the Git-ignored `.env.local`:

```dotenv
DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_LOCAL_ADMIN_SECRET
```

Provision or verify the fictional teacher with `node --import tsx scripts/provision-teacher.ts`. It creates only `teacher@classcompass.example`, sends no email, generates a strong password and writes the login to Git-ignored `.local/teacher-login.json` with mode `0600`. Repeated runs reuse the existing working login. Do not add its password to Git or documentation. Keep `AI_MODE=fixture` for connected database testing without model calls, or select `live` with the already-configured OpenRouter key. The teacher's first normal mutation seeds the authored roster, calendar and two original lesson versions into that account. No model result or teacher-confirmed finding is seeded implicitly.

## Connected verification

Run:

```sh
npm run test:supabase
```

The script requires the project URL, publishable key and local admin secret. Without these it exits with status 2 and a `BLOCKED` message; it does not claim a successful connected test. With them, it creates two temporary teacher accounts and checks:

- State round trips independently for both owners.
- Concurrent/stale commits fail atomically.
- RPC owner injection and nested cross-owner records are rejected.
- RLS hides the other owner's rows and blocks cross-owner writes.
- Existing history cannot be omitted or rewritten.
- Private storage rejects another owner's download, signed URL and upload.
- Anonymous database and storage access is denied.

It removes its temporary files and identities in `finally`; any cleanup failure is reported explicitly. Run against the dedicated ClassCompass project. These are real integration calls that create and remove temporary records, not mocked checks.

## Operational notes

The local backend uses the same domain transactions but has a single-machine file lock. Hosted environments must use Supabase. Connected resets are deliberate administrative operations; the web reset endpoint remains local-fixture-only. Restrict the pre-provisioned teacher account and do not expose an admin key in `NEXT_PUBLIC_*` variables.

Source: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), checked through Context7 during implementation.

Compatibility source: [Supabase RPC serialization retry advisory](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).
