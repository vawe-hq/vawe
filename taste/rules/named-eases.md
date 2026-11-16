---
id: named-eases
step: motion
principle: Take every curve from the EASE names (exact linear()), not from a CSS keyword and not from a hand-fitted cubic-bezier. The CSS keywords ease, ease-out and ease-in-out are not a default for everything.
limit: a move longer than 0.3 s is not on linear or on a bare CSS keyword with no curve of its own; one to two eases per scene
range: EASE.land, landSoft, settle, swap, glide, carry, leave, launch, pop, nudge, snap; sampled springs with 8 or more stops; vary eases like font weights (repeated like elements may take vary), and two layers moving in one beat differ in duration or offset
break-when: linear is allowed on the interior legs of a multi-key camera path (keys()), where constant speed is the point; a scripted page is not measured by the lint; two layers that share an ease and are offset are fine
instead: swap the keyword or bezier for EASE.land (entrance), EASE.launch (exit) or EASE.carry (move), at most 2 eases per scene (taste/craft/motion-craft.md). The /easing pages may show the nearest bezier as a reference only. Pick the scene ease from the signature (a punchy brand tightens durations and stagger, a calm one stretches them; set it once as :root custom properties).
check: linear-move, default-ease, ease-count, lockstep, repeat-run
judge: Is any move on a bare keyword or a hand-fitted bezier? Does frame 1 jump? How many eases does each scene use, and do two layers in one beat move in lockstep?
prevents: "no more than two" independent tweens share one ease; the presets give every enter the same land ease. feedback: "CSS curves must be smooth (never approximate an exponential with cubic-bezier)". A hand-fitted bezier starts too hard and stops too early. doc banned-defaults: ease-out on everything is the stock-template tell.
dial: ease
status: active
scored: yes
numbers: {"linear_move_limit_s":0.3,"eases_per_scene_min":1,"eases_per_scene_max":2,"lockstep_tol_s":0.02}
print-motion: take curves from EASE names (or a sampled spring), not a CSS keyword or a hand-fitted cubic-bezier
craft: motion-craft
---

## Example

easing: EASE.land. Wrong: easing: "ease-out" on every element. Scene 2 uses EASE.land and EASE.glide only.

Draft check, ease-count and lockstep: the draft check counts the eases of a scene's entrances (a scene ends at a gap of 1 s between entrances) and names two layers that enter on the same frame with the same duration.

Why and sources: [motion-craft](../craft/motion-craft.md).
