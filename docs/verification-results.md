# Verification results

Checks performed on September 19, 2026. All work, student identities and handwriting images used in these checks are fictional. Prepared AI results and live provider checks are reported separately.

## Completed checks

| Check | Result and scope |
| --- | --- |
| Authored specification | The fixture validator passed 340 assertions covering curriculum, evidence cases, lesson timing, contracts and 76 document links. |
| Deterministic tests | 71 tests across 10 files passed. They cover exact fraction arithmetic, evidence eligibility, correction/history behavior, proposal constraints, atomic persistence, uploads, origin/auth boundaries, saved jobs, provider errors and asset integrity. |
| Browser acceptance | Three Chromium tests passed: the complete baseline/correction/selected-application/follow-up journey; four routes at a 390-pixel viewport without horizontal overflow; and actual image/PDF uploads. The primary journey also passed again after separating student directions from teacher-only print guidance. |
| Connected application | Eight real HTTP lifecycle checks passed against the dedicated Supabase project. They used teacher cookies, signed private PDF uploads, 32 baseline and 16 follow-up responses, both teacher corrections, two accepted lessons, materials/calendar/history checks, then logout and denied access. These checks made zero live model calls. |
| Supabase isolation | Two temporary authenticated owners verified database RLS, private Storage, immutable history, rejected owner injection, concurrent/stale revision conflicts, and anonymous denial. Temporary test users and objects were removed. |
| Production build | Next.js production compilation passed. The artifact guard inspected 21 browser assets and 11 server traces: reference extraction payloads stayed out of browser bundles, and local credentials/runtime state stayed out of deployment traces. |
| Print inspection | Generated student activities and separate teacher keys were rendered and visually inspected. Actual browser print output was checked on US Letter and A4, including working space, fraction bars, unclipped text and separation of student directions from teacher guidance. |
| Asset integrity | All 25 manifest entries matched their file hashes. The 16 synthetic handwriting images are 1700 × 2200; each maps to the intended template and server-only prepared extraction. Runtime lesson JSON validates against application contracts. |

The connected run summary is saved privately at `.local/connected-verification.json`; print inspections are in `.local/print-qa/`. Neither directory is committed. The public CI workflow repeats credential-free validation and the browser suite; its actual remote status must be checked on GitHub, independently of local results.

## Live provider availability

The application is configured for the exact free endpoints `google/gemma-4-26b-a4b-it:free` and `deepseek/deepseek-v4-flash-0731:free`. It does not silently substitute prepared outputs or a paid model.

Initial Gemma attempts returned rate limits, including a further attempt after a roughly 20-minute cooldown. The first DeepSeek call timed out at 75 seconds with the provider's default high reasoning setting. A separate tiny strict-JSON DeepSeek diagnostic succeeded in 1.16 seconds after explicitly disabling reasoning. Text analysis/planning now explicitly disables optional reasoning; image extraction is unchanged. The first full text-analysis attempt returned structured findings that failed domain evidence validation and were rejected. That result is not counted as successful instructional analysis. Further bounded diagnosis is in progress; the current checkpoint does not claim a successful full live workflow.

The full live handwriting evaluation has not completed: **0 of 16 scans and 0 of 48 responses have been evaluated successfully. No accuracy percentage is claimed.** Prepared demonstration behavior remains available independently of provider capacity. See [implementation details](implementation.md) and run `npm run test:live` to measure current providers.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run verify
npm run test:e2e
```

Connected verification needs private Supabase configuration and the demo teacher login. Start a Supabase-backed instance on port 3002, then run `npm run test:supabase` and `npm run test:connected` as described in [Supabase setup](supabase-setup.md) and [implementation details](implementation.md). `npm run test:live` deliberately contacts the configured free providers.

Changing `AI_MODE` affects new processing. Refreshing findings reuses the saved, teacher-effective readings and does not erase corrections or re-transcribe existing submissions. Their original extraction provenance remains attached. Use a new upload/batch to evaluate fresh vision extraction after switching modes; mixed prepared/live stages must not be presented as an all-live OCR demonstration.

## Boundaries

This is a working prototype for the registered Grade 5 fraction unit. It has not been validated on real children's handwriting or in a real classroom. Teacher participation, a recorded submission video and a public hosted deployment are separate from the completed local application and repository. The calendar beyond the unit is a constrained preview. No measured learning gains, permanent mastery labels or general-purpose curriculum coverage are claimed.
