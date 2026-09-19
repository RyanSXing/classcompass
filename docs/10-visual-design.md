# Visual design: Blooket-inspired teacher workspace

The user selected Blooket as the strong visual reference after the initial specification was completed. This document replaces the earlier muted neutral/teal direction and owns visual styling. Document 01 still owns behavior, routes and teacher decision flows.

## Reference and intended character

Use the familiar classroom-tool character of Blooket's publicly documented teacher dashboard: a saturated vertical navigation rail, a prominent raised action button, clear selected navigation, rounded heavy headings, straightforward content panels, and spacious clickable surfaces. The reference is its teacher workspace, rather than its marketing page or an individual game screen. Official references inspected: [navigation/history](https://help.blooket.com/hc/en-us/articles/16179884291991-How-to-Access-Your-Blooket-Reports) and [My Sets/folder layout](https://help.blooket.com/hc/en-us/articles/16177978219799-How-to-Organize-Blooket-Question-Sets-with-Folders). These are published screenshots, not a claim to have inspected a signed-in current account.

ClassCompass should feel colorful, approachable, substantial and easy to navigate. Use strong visual resemblance in the shell and component character. Create ClassCompass's own logo, illustrations, copy, design tokens and implementation. Do not import Blooket's source/CSS, logo, characters/Blooks, artwork, sounds, screenshots, or game backgrounds into the product. Reference links belong in these docs; the application presents ClassCompass as its own product without suggesting affiliation. These are design/asset requirements, not a claim of legal clearance.

## Original visual identity and tokens

Use a simple original compass mark drawn from basic SVG geometry, with a small fraction segment as an optional brand detail. The wordmark reads **ClassCompass** in the application typeface; do not reproduce Blooket's wordmark lettering. Keep classroom decoration geometric: fraction bars, notebook corners, compass directions and simple paper shapes. No collectible mascot system is needed.

The following values are newly selected ClassCompass tokens, not sampled from Blooket:

| Token | Value | Use |
| --- | --- | --- |
| Brand/sidebar | `#6B3DB8` | Saturated violet navigation and key headings |
| Brand dark | `#4D2787` | Sidebar edge and raised-button depth |
| Brand pale | `#EEE7FA` | Selected filters and subtle section fills |
| Canvas | `#F5F3FA` | Light lavender-gray application background |
| Surface | `#FFFFFF` | Evidence, editor and lesson comparison panels |
| Ink | `#242136` | Primary body text and numbers |
| Muted ink | `#625B73` | Secondary metadata on light surfaces |
| Action | `#007F8B` | Main application buttons with white text |
| Bright accent | `#58D3D8` | Sidebar Upload work button, paired with dark ink |
| Pending review | `#FFF1C9` / `#765000` | Pale amber fill / dark label |
| Confirmed/saved | `#E1F5E9` / `#236640` | Pale green fill / dark label |
| Error/stale | `#FCE4E7` / `#9B2439` | Pale red fill / dark label; explain the actual state in words |

Do not use violet, turquoise or card-cover colors as student ability indicators. Keep review-state colors consistent everywhere. A draft needs a visible Draft label; an amber panel is not enough.

Use **Nunito** with a standard sans-serif fallback, from its legitimate upstream font distribution with its license recorded during implementation. Use 400/600 for prose, 700 for controls, 800/900 for page headings. This gives rounded, substantial type while keeping evidence readable. If a font cannot be bundled reliably, retain the fallback rather than fetching an unverified imitation. Render fractions clearly with accessible text equivalents and appropriately aligned numerators/denominators. Never use decorative type for student transcriptions or long instructional text.

Sizes: page heading 32px/1.2, section heading 22px/1.3, body/control 16px/1.5, metadata 14px/1.4. In dense review headers use 28px page headings. Use an 8px spacing rhythm with 4px for compact internal gaps. Panel radius 16px, button/input radius 10px, badge radius 999px. Panels have a thin lavender-gray border and a restrained 3px lower shadow; raised primary buttons have a 4px darker bottom edge. Hover may lift 1–2px; press removes part of the lower edge. Use roughly 120–160ms transitions and respect reduced motion.

## Application shell

At desktop widths of 1,024px or more, use a fixed **224px violet sidebar** and a light main canvas. The sidebar contains the original mark/wordmark, a prominent aqua **Upload work** action, then the existing **Classroom**, **Lesson plan**, and **Calendar** destinations with consistent line icons and 48px rows. The active destination is a white rounded inset with violet icon/text. Account/logout lives at the bottom; connected-only actions stay conditional. Upload work opens the existing classroom upload flow; it does not add a new product feature.

Above main content, use a 64px utility bar for classroom identity, compact provenance badges and the teacher menu. Below it place the breadcrumb/title and the current page's primary action. Use 24px page padding and 20–24px card gaps. Let the evidence workspace use available width instead of forcing it into a narrow marketing-page container. Use the existing routes; do not add Discover, Market, games, points or a leaderboard simply because the reference has them.

At widths below 1,024px, collapse the sidebar to an explicit Menu drawer with the same destinations and upload action. Retain the current page title and mode badges. Use 16px mobile padding and full-width cards. At 390px, evidence, interpretation, and paired Before/After cards stack with the existing item switcher. Approval actions remain reachable and must not cover content or keyboard focus. No icon-only navigation guessing.

## Screens and components

### Classroom

Lead with **Your classroom** and the next useful action. Show three compact colorful status cards for work received, findings awaiting review, and changes awaiting a decision. The color comes from an icon tile or top band with a white content body; counts describe workflow, not student proficiency.

Below, arrange the authored unit/lesson, baseline work, and follow-up work as substantial library-style cards. Give each an original geometric cover, clear title/date, truthful status badge and one obvious action. Use two or three columns when space allows, one on mobile. Keep actual classroom content recognizable; do not fill the page with fake curriculum or dead placeholder tiles to imitate a content marketplace.

The lesson import and worksheet upload remain separate panels with their existing validation/preview behavior. A playful upload card can use a dashed inner drop target, but file requirements, template selection, student mapping and support context remain visible.

### Evidence review

Carry the violet shell and rounded controls into the page, then use quiet white working surfaces. At 1280×800, keep the source scan on the left and interpretation/actions on the right. The student/question selector and Pattern/Individual tabs use rounded segmented controls. Pattern cards have a colored icon tile, a short explanation, affected count, review state and explicit selection controls.

Scan pixels retain their actual colors. Highlight only the registered question region with an outline and a light overlay; retain an unmodified view and zoom. Do not tint the whole worksheet, recolor handwriting, or hide uncertainty behind a friendly illustration. Transcription, help context, mathematical check, and teacher actions remain separate readable sections.

Confirmation buttons may use the raised treatment; disabled/ineligible states must state why. Bulk confirmation is still the exact reviewed selection. A celebratory style must never make an unconfirmed finding look accepted.

### Lesson comparison

Use a friendly large lesson title, a compact **45 minutes** badge and a five-block timeline. Keep the core side-by-side relationship: evidence pane plus a Before/After change card. Put an explicit selection checkbox on the change card, with Edit and Keep original as secondary actions. The saved/draft distinction remains visible.

Represent the three concurrent activities with three small color-accented lane cards inside one shared **12-minute practice block** container. Their cards do not receive independent apply buttons, and their colors describe activity types only. Show student membership and check-in instructions as ordinary text/chips. The existing sticky footer shows selected changes, resulting duration and **Apply selected changes**; color and motion cannot substitute for this approval action.

### Calendar, progress and materials

Calendar entries use rounded cards/chips; accepted entries have solid outlines and proposed entries have dashed outlines plus **Preview**. Locked assessment dates show a lock icon and text. A saturated cover/header can frame the calendar, while the date grid stays light and readable. Preserve the existing unit/wider preview scope.

Student progress uses dated white observation cards with the same semantic status badges. Avoid scores, ranks, trophies and progress bars that would imply permanent mastery. Keep support, difficulty, original work and superseded history within each observation's details.

Materials use colorful selection tabs/cards around a plain white print preview. Printed pages remove navigation, shadows, colored cover panels and teacher-facing status chrome; preserve clean black-on-white math, working space, original content and the separately selected teacher key. Printing requirements from documents 02/06 still apply.

## Interaction, accessibility and implementation handoff

- Use the existing component stack and shared semantic design tokens. Customize copied shadcn components consistently; default styling alone does not satisfy this direction.
- Interactive targets are at least 44×44px where practical; keyboard focus has a visible high-contrast outline and offset on both light panels and the violet sidebar. Verify actual text/background contrast, including hover/disabled/error states, during the build.
- Use one icon family and clear labels. Cards with multiple actions should be structured with separate controls; avoid nested buttons or making an entire card compete with its checkbox.
- Status always includes text/icon meaning. Keep Fixture analysis, Live analysis, Fictional student data, Needs review, Stale and Saved distinguishable and readable.
- Animation is limited to small component feedback. No automatic confetti, sound, bouncing evidence panels, or motion that delays a review action.
- Implement/classroom-check the shell, card, button, tab, badge and form treatments before spreading styles across every page. Inspect the real evidence and lesson workspaces at 1280×800 and mobile at 390×844.

Visual acceptance: the result should clearly reflect the Blooket-inspired saturated sidebar, raised buttons, rounded heavy headings and approachable content-card hierarchy; it should be recognizably ClassCompass through its own identity, content, original assets and evidence-to-plan workflow. Functional acceptance and all teacher approval boundaries remain defined by the existing specifications.
