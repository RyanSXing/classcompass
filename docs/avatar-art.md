# Student avatar art

Eight original fictional student portraits for ClassCompass. Generated on 2026-09-20 with the built-in `image_gen.imagegen` tool: one independent generation per student. No source photos, external character references, stock art, or CLI fallback were used.

These portraits belong to the fictional classroom roster. They do not represent real students. The web app may crop them with CSS; the repository contains the unmodified final PNG output from the generator.

## Assets

| Student | Served path | Subject and palette appended to the shared prompt |
| --- | --- | --- |
| Avery | `/avatars/avery.png` | Light warm peach skin, dark chestnut short wavy hair with a curved side part, dusty blue crew-neck shirt, soft pale butter-yellow solid background. |
| Blake | `/avatars/blake.png` | Deep warm brown skin, short round black curls represented as one simple cloud-like silhouette, mustard yellow crew-neck shirt, soft pale dusty-blue solid background. |
| Casey | `/avatars/casey.png` | Medium tan skin, straight dark brown hair in a chin-length rounded bob, sage green crew-neck shirt, soft pale peach solid background. |
| Devon | `/avatars/devon.png` | Warm medium brown skin, very short dark brown flat rounded hair, terracotta crew-neck shirt, soft pale sage solid background. |
| Emery | `/avatars/emery.png` | Light warm peach skin, auburn hair in two small low rounded bunches with plain ties, muted mustard crew-neck shirt, soft pale lavender solid background. |
| Finley | `/avatars/finley.png` | Medium warm golden skin, black short straight hair with a soft side-swept fringe, dusty blue crew-neck shirt, soft pale apricot solid background. |
| Gray | `/avatars/gray.png` | Light brown skin, dark brown fluffy short hair as three broad rounded shapes, simple round dark spectacles, sage green crew-neck shirt, soft pale butter-yellow solid background. |
| Harper | `/avatars/harper.png` | Deep warm brown skin, black hair in two simple rounded puffs, muted terracotta crew-neck shirt, soft pale dusty-blue solid background. |

All eight final images were visually inspected for a single character, clear face, simple shapes, warm palette, no text, and room for a circular UI crop. They use the same face and clothing style, with distinct hair shapes, skin tones, and shirt colors. The originals are 1254 × 1254 pixels.

## Shared generation prompt

Each image used the exact shared prompt below, followed by `Subject and palette: ` and its table entry above.

```text
Use case: illustration-story
Asset type: individual square student avatar for ClassCompass, a teacher classroom app
Primary request: Draw ONE original fictional child, around age 10, with a friendly expression. Very simple flat cartoon illustration with only a few bold rounded shapes, tiny dark dot eyes and one simple small smiling mouth.
Style/medium: Minimal hand-drawn vector-like flat art, subtly imperfect solid edges, like a warm modern school notebook. No painted rendering, texture, gradients, dimensional shading, dramatic lighting or elaborate details. No emoji style and no 3D.
Composition/framing: Square image, straight-on head and upper shoulders centered. Entire hair and shoulders within central 75 percent of image, generous solid background margin. Safe to crop the square to a circle without cutting the head. Child head fairly large, shoulders small, face clean and readable at 32 pixels.
Constraints: One character only. Solid-color plain crew-neck shirt. No props. No text, names, letters, numbers, logos, watermark, or badges. Original invented cartoon character, not based on any real person or franchise. Simple round ears, no detailed nose. Keep clothing and hair shapes very simple.
```

## Blake background correction

Blake's first output had transparency in the background. A single built-in image edit filled the background; the final edited output is `public/avatars/blake.png`. The portrait was inspected before and after the edit. The exact edit prompt was:

```text
Use case: precise-object-edit
Asset type: square student avatar for ClassCompass
Input image: edit target, the invented cartoon child's portrait.
Change only the transparent background to an opaque, completely solid pale dusty blue (#CADFE9). Keep the character exactly the same: head position, shape, smiling face, hair, skin, yellow shirt, crop, and dimensions. The entire square must have an opaque background. No text or other additions.
```

## Integration

- Use the served paths above; all files are saved in `public/avatars/`.
- Prefer a circular or softly rounded crop and keep the full square image inside the crop.
- If the student's visible name is beside the portrait, use an empty image alt value to avoid reading the name twice.
- The art is decorative. Student identity, stages, and actions must remain available as text.
