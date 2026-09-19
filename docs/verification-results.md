# Verification results

Checks performed on September 19, 2026. All work, student identities and handwriting images used in these checks are fictional. Prepared AI results and live provider checks are reported separately.

## Completed checks

| Check | Result and scope |
| --- | --- |
| Authored specification | The fixture validator covers all five assignments, answer keys, evidence cases, lesson timing, contracts and local document links. The expanded catalog has 40 scans, 120 responses and five 45-minute lessons. |
| Deterministic tests | 101 tests across 13 files passed. They cover disjoint answer counts, assistance, partial/duplicate uploads, exact fraction arithmetic, current and historical evidence, teacher corrections, catalog migration, proposal constraints, persistence, uploads, origin/auth boundaries, saved jobs, provider errors and asset integrity. |
| Browser acceptance | All five Chromium scenarios passed in 38 seconds without retries: correction and selected lesson changes; five-assignment loading and linked individual analytics; eight routes at 390 pixels and keyboard navigation; real PNG/PDF uploads; and partial uploads, unresolved flags and historical readings. Wrong-date planning is disabled with a link to the correct lesson; returning from history preserves the selected student and question. |
| Connected application | Thirteen real HTTP lifecycle checks passed against Supabase. Teacher cookies and private source uploads produced five assignments, 40 effective worksheets and 120 responses. Both earlier accepted lessons, corrections, observations and materials remained unchanged. New samples were not autoapproved; repeated loads and analysis were idempotent. Logout denied access. Zero live model calls. |
| Supabase isolation | Two temporary authenticated owners verified database RLS, private Storage, immutable history, rejected owner injection, concurrent/stale revision conflicts, and anonymous denial. A saved two-lesson classroom upgraded to five without rewriting accepted versions; a second read was idempotent. Temporary users and objects were removed. |
| Production build | Next.js production compilation passed. The artifact guard inspected 28 browser assets and 14 server traces: reference extraction payloads stayed out of browser bundles, and local credentials/runtime state stayed out of deployment traces. |
| Print inspection | Generated student activities and separate teacher keys were rendered and visually inspected. Actual browser print output was checked on US Letter and A4, including working space, fraction bars, unclipped text and separation of student directions from teacher guidance. |
| Asset integrity | All 59 manifest entries matched their file hashes. The 40 synthetic handwriting images are 1700 × 2200; each maps to its template and server-only prepared extraction. The original 16 scan hashes were preserved. Runtime lesson JSON validates against application contracts. All 14 authored PDFs and five assignment contact sheets were visually inspected. |
| Contrast and keyboard focus | Checked main text/background pairs: body 14.18:1, muted text 6.44:1, sidebar text 7.04:1, primary action 4.76:1 and upload action 8.71:1. Sidebar keyboard focus uses a white outline against violet. This is targeted visual verification, not a comprehensive accessibility certification. |
| Remote CI | The data/catalog checkpoint passed both Ubuntu jobs in [this run](https://github.com/RyanSXing/classcompass/actions/runs/35477031435). [GitHub Actions](https://github.com/RyanSXing/classcompass/actions/workflows/ci.yml) repeats credential-free validation and the browser suite for each interface checkpoint. |

The connected run summary is saved privately at `.local/connected-verification.json`; print inspections are in `.local/print-qa/`. Neither directory is committed. The public CI workflow repeats credential-free validation and the browser suite. The production app was restarted and manually checked to preserve saved evidence and proposals with no new browser warnings or errors.

## Live provider availability

The application is configured for the exact free endpoints `google/gemma-4-26b-a4b-it:free` and `deepseek/deepseek-v4-flash-0731:free`. It does not silently substitute prepared outputs or a paid model.

Gemma returned provider rate limits, including after a roughly 20-minute cooldown. A tiny strict-JSON DeepSeek diagnostic succeeded in 1.16 seconds with reasoning disabled, but this did not predict full-task quality. Full-class text findings failed evidence/coverage checks, including incorrect claim scopes, cross-student references and unsupported interpretations. Grouping actual evidence by student and narrowing the output schema removed some structural errors; substantive analysis failures remained. A separate low-reasoning analysis reached the 75-second limit and did not trigger a planning call.

After constraining authored lesson/material IDs, **one live proposal passed domain validation and simulated application in 24.5 seconds**, using previously teacher-confirmed fictional findings. It covered all eight students within one 12-minute block and selected targeted support for Avery, Blake and Casey. Some other placements differed from the prepared recommendation. This establishes a bounded proposal integration result, not ideal instructional quality or successful live analysis. No actual classroom state was changed by the diagnostic, and no external teacher evaluated the model output.

The production default explicitly disables optional text reasoning; the low setting is evaluation-only. Neither tested setting established a complete live loop. Private reports include `.local/live-reasoning-initial.json`, `.local/live-reasoning-evaluation.json`, `.local/live-reasoning-low-evaluation.json` and `.local/live-gemma-diagnostic.json`. Rejected outputs remain outside the saved classroom; the application never silently switches to prepared outputs.

The original live handwriting evaluation has not completed: **0 of 16 scans and 0 of 48 responses were evaluated successfully. No accuracy percentage is claimed.** The expanded five-assignment catalog has not been evaluated with live models; the revamp checks made no live calls. Prepared demonstration behavior remains available independently of provider capacity. See [implementation details](implementation.md) and run `npm run test:live` to measure current providers.

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
