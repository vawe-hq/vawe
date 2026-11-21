# vawe brand note

Facts for films about vawe itself. They are not general taste rules: a film for any other brand takes
its face and surface from the kit (`node scripts/brand/kit.mjs <url> <name> --init`; rules
`palette-from-brand` and `typeface-default`).

- Ground pure black `#000`, panels `#0a0a0a` and `#111`, hairlines `#242424` and `#3a3a3a`, ink `#fff`, `#ededed` and `#a1a1a1`. The accent `#3291ff` is used rarely, on one thing (rule `accent-share`), with black ink on it.
- Never a full-frame cobalt flood as the ground. The owner said "vawe is not blue".
- Faces: Geist (headings at weight 600, tracking -0.045em to -0.06em at display sizes; body 400) and IBM Plex Mono for numbers and labels. Not Anybody, Inter or Space Grotesk. The film frame radius is 28px.
- Evidence: the vawe sting held a full cobalt field from 2.3 s to 5.0 s (anti-pattern D,
  `taste/anti-patterns/D-one-field-held.md`).
- Source of truth: `site/app/globals.css` and `site/app/layout.tsx` in vawe-hq/vawe-site. Re-check them before you rely on
  these values.
