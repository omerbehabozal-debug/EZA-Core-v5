/**
 * V3.3 — topic visibility, typography director, and scene clarity contracts.
 */

export const TOPIC_VISIBILITY_RULE = `Topic visibility rule:
A viewer should infer the conversation topic within 3 seconds.
The poster must not become so abstract that the original topic disappears.
Use concrete visual traces from the conversation.
Avoid generic metaphors that could apply to any topic.
Show what was discussed through scene details — not through summary text.`;

export const ABSTRACTION_LIMIT = `Abstraction limit:
Do not remove the topic.
Do not replace the topic with only emotion.
The poster should show both:
1. what was discussed (through concrete visual evidence)
2. why it mattered (through mood, light, and meaning)`;

export const SCENE_CLARITY_RULE = `Scene clarity rule:
The scene must be instantly readable.
Avoid vague foggy silhouettes unless directly supported by the conversation evidence.
Avoid empty atmospheric scenes with no concrete subject.
Use one strong cinematic setting.
Use a clear hero visual anchor.
The scene should feel memorable, not generic.`;

export const TYPOGRAPHY_DIRECTOR_CONTRACT = `Typography director:
Design the typography as a professional film poster / editorial cover.
The text must be intentionally placed, balanced and readable.

Title:
- Large, dominant, but not oversized.
- 2 or 3 lines maximum.
- Must not cover the main subject's face or core evidence details.
- Prefer upper-left, upper-center, or strong negative-space area.
- Use refined editorial serif or premium display typography.
- Turkish characters must render correctly.

Body:
- Maximum 2 short lines.
- Must be much smaller than the title.
- Must sit close enough to the title to feel like one composition.
- Do not scatter text around the poster.
- Do not place body text at random edges.

Composition:
- Keep all text inside a coherent text zone.
- Text zone should occupy 20–30% of the poster.
- Scene should occupy 70–80%.
- No more than 2 text zones.
- Avoid decorative labels, badges, cards, insight sections, bottom panels.
- Do not create sections like "Bugün Görünen Desen" or "Yarın İçin İpucu".`;

export const OPENAI_POSTER_TEXT_CONTRACT = `OpenAI poster text contract:
Render only these text fields in-image:
- Title (mirror title)
- Short mirror copy (body)
- Optional tiny closing line (if provided)

Forbidden text elements:
- section title
- badge
- metric
- score
- label
- footer panel
- insight block
- hint block
- checklist
- dashboard UI
- coaching copy

Logo, date, and SAINA signature are added by system overlay — do NOT render them.`;

export const VISUAL_METAPHOR_TRANSLATION_V33 = `Visual metaphor translation (V3.3):
Interpret evidence through atmosphere, light, scale and material — but keep traces recognizable.
Do not render literal keyword lists or checklist layouts.
Travel: show route, street, ticket, notebook, local atmosphere — not landmarks or tourism brochure.
Architecture: show material, facade, sketch, model, light-shadow — not villa renders or real-estate ads.
AI: show human reflection, notes, screen glow, decision — not robots, holograms or neon circuits.
Personal care: show ritual, counter, comparison note — not product advertisement or clinical treatment.
Cars: show silhouettes, garage, route note, keys — not showroom commercial or brand logo spectacle.
Spiritual topics: show silence, direction, inner space — not preaching or religious cliché.`;

export const EVIDENCE_SCENE_AVOID = `Evidence-specific avoid:
- tourism brochure
- postcard layout
- giant landmark cliché
- checklist scene
- stock photo smiling tourist
- product packshot hero
- showroom commercial
- robot face
- neon cyberpunk brain
- dashboard UI
- insight card panel
- generic fog silhouette with no subject`;
