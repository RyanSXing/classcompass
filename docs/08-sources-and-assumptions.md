# Sources, provenance, and assumptions

Prepared September 19, 2026. Product decisions come from the project owner's conversation. Curriculum, fixture responses, architectural defaults and test requirements were authored for this project; they are not findings from real pupils or a claim of validated educational effectiveness.

## Technical sources consulted

Context7 was used to resolve and query `/vercel/next.js`, `/supabase/supabase`, and `/openrouterteam/docs` for current backend, private-storage/authorization, and structured-output behavior. Official pages supplied additional implementation details. Recheck time-sensitive capabilities during the build.

| Source | What it supports |
| --- | --- |
| [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) | Current stable installation/runtime requirements; resolve compatible package versions at build time. |
| [Next.js backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) and [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) | Server-side HTTP handlers; hosting limitations are separate from framework features. |
| [Supabase database overview](https://supabase.com/docs/guides/database/overview) and [database functions](https://supabase.com/docs/guides/database/functions) | PostgreSQL persistence and transactional server operations. |
| [Supabase server-side authentication](https://supabase.com/docs/guides/auth/server-side/nextjs) | Framework-aware server/browser clients and authenticated session handling. |
| [Supabase bucket fundamentals](https://supabase.com/docs/guides/storage/buckets/fundamentals) | Private storage and controlled access; source scans need not be publicly readable. |
| [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) | Component setup for the selected UI stack. |
| [PDF.js examples](https://mozilla.github.io/pdf.js/examples/) | Local PDF page rendering and a compatible worker. |
| [Zod JSON Schema](https://zod.dev/json-schema) | Deriving supported JSON Schema from validation contracts; provider compatibility still needs validation. |
| [CSS printing](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing) | Print styles and page-specific presentation for browser print/PDF. |
| [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs) | Optional hosting path; actual duration/body/environment limits must be checked for the chosen deployment. |
| [Gemma free model](https://openrouter.ai/google/gemma-4-26b-a4b-it:free) | Exact selected image-capable extraction endpoint and its advertised parameters. |
| [DeepSeek free model](https://openrouter.ai/deepseek/deepseek-v4-flash-0731:free) and [OpenRouter model catalog](https://openrouter.ai/api/v1/models) | Exact selected reasoning endpoint; its current advertised input modality is text, not images. |
| [OpenRouter image input](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding) | Image content in chat-completion requests. |
| [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs) | Schema formatting and provider-parameter routing; availability varies by exact endpoint/provider. |
| [OpenRouter limits](https://openrouter.ai/docs/api_reference/limits) and [published documentation constants](https://raw.githubusercontent.com/OpenRouterTeam/docs/main/snippets/exports/constants.mdx) | Current free-model limits and account-dependent allowances; free capacity is not guaranteed. |

The choice of Next.js is a project-fit decision: this app mainly coordinates UI, database operations and remote inference, and needs no Python-only inference pipeline. It is not a universal claim that one framework is objectively superior for every backend. The user confirmed this selection.

## Visual reference selected by the user

The user subsequently selected Blooket as the strong UI reference. Official public [history/navigation screenshots](https://help.blooket.com/hc/en-us/articles/16179884291991-How-to-Access-Your-Blooket-Reports) and [My Sets/folder screenshots](https://help.blooket.com/hc/en-us/articles/16177978219799-How-to-Organize-Blooket-Question-Sets-with-Folders) were visually inspected on September 19, 2026. They inform document 10's saturated sidebar, rounded headings, raised buttons and content layout. The inspection used published screenshots rather than a signed-in account. ClassCompass's token values, compass branding, artwork and implementation are authored separately; no Blooket media or source was copied into the project.

## Hackathon context

The [SASEhack 2026 Hacker Guide](https://sase-hack.notion.site/SASEhack-2026-Hacker-Guide-38b9bed74f8e8093aba7fd8132b70a16) was inspected during planning. Recorded requirements:

- Hacking begins September 18, 2026, 5 PM Pacific; submission/code freeze is September 20, 2026, 11:59 PM Pacific.
- Submission uses Devpost and includes a public GitHub repository with README, slides link, and a video at most five minutes long.
- A deployed website is optional. AI-assisted development is allowed.
- Judging includes technical execution, originality, usability/design, practical impact/viability, and presentation.

These are submission constraints, distinct from the fictional classroom dates. Recheck the official guide before submission; do not infer that this documentation task has published, deployed, or submitted anything.

## Assumptions explicitly selected for implementation

The defaults in document 00 are deliberate choices needed to make the build self-contained: one teacher/classroom, local fixture mode, single-page known layouts, authored two-week unit plus an adjacent-unit preview, fixed lesson durations, and browser-driven resumable processing. They are reversible implementation choices, not facts about all schools or implied user requests for a larger platform.

Teaching content is designed to exercise inspectable product behavior. The denominator-addition cases, support-context error, handwriting correction example, and mixed follow-up are authored scenarios. Their expected outputs are test assertions. A live model is evaluated against them; hidden expectations are never injected to manufacture success.

## External dependencies and honest claims

| Item | Current status | Implementation response |
| --- | --- | --- |
| OpenRouter credentials | Configured in the build workspace's Git-ignored `.env.local`; read-only authentication verified September 19, 2026, with zero model-generation requests | Use the existing local key for live adapter tests during implementation. Do not print, commit, or include it in prompts. Live model/handwriting evaluation remains not run. Other clones require their own local configuration. |
| Supabase project/account | Installed CLI authenticated and project listing verified September 19, 2026; no ClassCompass project linked/selected yet | Use the existing CLI session after project selection. Deliver migrations, RLS and authenticated adapter; validate connected application behavior against the selected test project. Avoid printing retrieved secrets. |
| Model handwriting quality | Unmeasured on actual assets | Generate/obtain scans, measure all 48 responses, expose uncertainty and corrections; report results. |
| Free model capacity/availability | Time-sensitive, no guarantee | Recheck exact IDs/parameters/limits, persist progress and errors, allow explicit retry; never silently charge or switch. |
| Grade 5 teacher review/participation | Possible, unconfirmed | Offer the authored materials/script for review; do not claim endorsement. |
| Genuine handwritten assets | Not present yet | Generate disclosed synthetic samples or use supplied handwriting, then inspect alignment and actual extraction. |
| Public repository | Created at the user's request: [RyanSXing/classcompass](https://github.com/RyanSXing/classcompass) | Publish project documents and code; keep credentials, local agent tooling and runtime data out of Git. |
| Deployment destination | Not selected | Deliver runnable local work and deployment instructions; do not claim a live site or hackathon submission. |
| Real pupil data/compliance | Outside this fictional demo | No real student records or compliance certification are assumed or claimed. |

Keep a brief implementation decision log for any necessary deviation: original contract, evidence of incompatibility, chosen replacement, user-visible effect, and verification. Do not hide a changed model, missing approval boundary, or unsupported integration behind an unchanged claim in the README.
