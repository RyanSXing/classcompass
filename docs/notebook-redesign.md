# Notebook redesign

This document records the current ClassCompass product shell. It changes visual presentation and navigation only; the evidence model, teacher review, source links, lesson-version rules, and calendar constraints remain the product boundary.

## Scope

The redesign turns the existing classroom workspace into a calm notebook-like application:

- A warm cream canvas uses subtle ruled lines, tan borders, dark brown body text, dusty-blue primary actions, and a warm yellow upload action.
- The desktop shell has a compact cream left rail with notebook ring-hole decoration, an original SVG compass mark, named line-icon navigation, and the teacher account area.
- The shared shell groups **Overview**, **Assignments**, **Students**, **Lessons**, **Calendar**, and **Assistant** around the teacher workflow. Navigation labels remain visible; icons do not carry meaning alone.
- Insight views present the class picture, student/date map, and student detail as separate paper cards. Detailed answer results remain available without becoming the visual focus.
- The Assistant uses a two-pane desk at wide widths: teaching notes and context on the left, conversation on the right.
- The Lessons page uses a dated lesson selector beside a readable current-plan preview. The preview shows the date, saved or draft state, objectives, timed blocks, linked work, and a route to the full plan. Selecting a lesson never changes it.

The design takes inspiration from the supplied Figma prototype's information hierarchy and paper character. ClassCompass keeps its own compass mark, icons, copy, layouts, and assets. It does not reuse Figma source layers or third-party brand assets.

## Student portraits

The eight fictional students have original, low-detail cartoon portraits generated for this product. Portraits support quick scanning beside the written student name; they do not represent evidence, performance, identity, or a student label. The text name remains the accessible identifier. See [avatar artwork](avatar-art.md) for the asset and generation record.

## Private account boundary

The product account is part of the interface rather than a visible demo control. In connected Supabase mode, the provisioned teacher signs in before classroom data is available, and sign-out returns to the login screen. The app routes ordinary reads and writes through that signed-in teacher's identity; no public signup screen is added. The product shell identifies fictional preview data only when demo tools are explicitly enabled.

No account password, provider key, Supabase secret, or runtime classroom data belongs in tracked documentation. Local fixture mode is still a loopback-only fictional workspace; it is not a substitute for the connected account boundary.

## Responsive behavior

At desktop width, the notebook rail stays fixed and the content workspace fills the remaining screen. Below the navigation breakpoint, the rail becomes a labeled menu drawer. At smaller widths, the Assistant's notes and conversation stack, insight cards stack, lesson dates become a compact grid, and the lesson preview keeps its full-plan action reachable without horizontal overflow.

Keyboard focus remains visible on paper and rail surfaces. Touch targets retain text labels and the existing page controls remain available from the responsive layouts.

## Rollback checkpoint

The pre-redesign project state is tagged `before-notebook-redesign-2026-09-20` at commit `eb631b3e74c4fddf0724835733792b4993a626a2`. That checkpoint preserves the earlier visual shell if the redesign needs to be compared or reverted through the normal Git workflow.
