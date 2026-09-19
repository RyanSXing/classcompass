# Verification results

Checks performed on September 19, 2026. All work, student identities and handwriting images used in these checks are fictional. Prepared AI results and live provider checks are reported separately.

## Completed checks

| Check | Result and scope |
| --- | --- |
| Authored specification | The fixture validator passed 345 assertions covering curriculum, evidence cases, lesson timing, contracts and 81 local document links. |
| Deterministic tests | 74 tests across 10 files passed. They cover exact fraction arithmetic, evidence eligibility, correction/history behavior, proposal constraints, atomic persistence, uploads, origin/auth boundaries, saved jobs, provider errors and asset integrity. |
| Browser acceptance | Three Chromium tests passed: the complete baseline/correction/selected-application/follow-up journey; four routes at a 390-pixel viewport without horizontal overflow; and actual image/PDF uploads. The primary journey also passed again after separating student directions from teacher-only print guidance. |
| Connected application | Eight real HTTP lifecycle checks passed against the dedicated Supabase project. They used teacher cookies, signed private PDF uploads, 32 baseline and 16 follow-up responses, both teacher corrections, two accepted lessons, materials/calendar/history checks, then logout and denied access. These checks made zero live model calls. |
| Supabase isolation | Two temporary authenticated owners verified database RLS, private Storage, immutable history, rejected owner injection, concurrent/stale revision conflicts, and anonymous denial. Temporary test users and objects were removed. |
| Production build | Next.js production compilation passed. The artifact guard inspected 21 browser assets and 11 server traces: reference extraction payloads stayed out of browser bundles, and local credentials/runtime state stayed out of deployment traces. |
| Print inspection | Generated student activities and separate teacher keys were rendered and visually inspected. Actual browser print output was checked on US Letter and A4, including working space, fraction bars, unclipped text and separation of student directions from teacher guidance. |
| Asset integrity | All 25 manifest entries matched their file hashes. The 16 synthetic handwriting images are 1700 × 2200; each maps to the intended template and server-only prepared extraction. Runtime lesson JSON validates against application contracts. |
| Contrast and keyboard focus | Checked main text/background pairs: body 14.18:1, muted text 6.44:1, sidebar text 7.04:1, primary action 4.76:1 and upload action 8.71:1. Sidebar keyboard focus uses a white outline against violet. This is targeted visual verification, not a comprehensive accessibility certification. |
| Remote CI | Both Ubuntu jobs passed: clean installation, validation/lint/types/unit tests/production build, and all three Chromium scenarios without retries. The first CI run exposed an upload-autostart race and a test interception race; both were fixed and verified in [the passing run](https://github.com/RyanSXing/classcompass/actions/runs/35472322388). Subsequent push results are available in [GitHub Actions](https://github.com/RyanSXing/classcompass/actions/workflows/ci.yml). |

The connected run summary is saved privately at `.local/connected-verification.json`; print inspections are in `.local/print-qa/`. Neither directory is committed. The public CI workflow repeats credential-free validation and the browser suite. The production app was restarted and manually checked to preserve saved evidence and proposals with no new browser warnings or errors.

## Live provider availability

The application is configured for the exact free endpoints `google/gemma-4-26b-a4b-it:free` and `deepseek/deepseek-v4-flash-0731:free`. It does not silently substitute prepared outputs or a paid model.

Gemma returned provider rate limits, including after a roughly 20-minute cooldown. A tiny strict-JSON DeepSeek diagnostic succeeded in 1.16 seconds with reasoning disabled, but this did not predict full-task quality. Full-class text findings failed evidence/coverage checks, including incorrect claim scopes, cross-student references and unsupported interpretations. Grouping actual evidence by student and narrowing the output schema removed some structural errors; substantive analysis failures remained. A separate low-reasoning analysis reached the 75-second limit and did not trigger a planning call.

After constraining authored lesson/material IDs, **one live proposal passed domain validation and simulated application in 24.5 seconds**, using previously teacher-confirmed fictional findings. It covered all eight students within one 12-minute block and selected targeted support for Avery, Blake and Casey. Some other placements differed from the prepared recommendation. This establishes a bounded proposal integration result, not ideal instructional quality or successful live analysis. No actual classroom state was changed by the diagnostic, and no external teacher evaluated the model output.

The production default explicitly disables optional text reasoning; the low setting is evaluation-only. Neither tested setting established a complete live loop. Private reports include `.local/live-reasoning-initial.json`, `.local/live-reasoning-evaluation.json`, `.local/live-reasoning-low-evaluation.json` and `.local/live-gemma-diagnostic.json`. Rejected outputs remain outside the saved classroom; the application never silently switches to prepared outputs.

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
