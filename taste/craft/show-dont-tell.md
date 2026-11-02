---
when: the film is all type in boxes, or you are about to author a product screen (an editor, a results grid, a dashboard, a chat, a card)
answers: "decoration versus explanation, what each claim shape wants, why the graphic must be the subject, three questions to ask by hand, how a product screen is designed for the video"
group: density
---

# SHOW, DON'T ONLY TELL: what to show, and how

A film can be well written, on palette, cut in time and directed hard, and still show the viewer
nothing. Every layer that carries information is a word: the viewer reads it, believes it or not, and
moves on. When this was last measured, about 4 in 10 shipped scenes carried no picture of any size and
the median film gave about 5% of its layers to picture. That is debt, not a house style. Nothing checks
this. Your eyes and a fresh critique do.

## Decoration is not explanation

Decoration dresses the frame and carries no information: a glow, a gradient, a hairline, a corner tick, a
scanline, grain, a vignette, a logo beside a wordmark. All of it can be beautiful. None of it tells the
viewer anything the words did not.

Explanation does work the words cannot: a bar whose length is the number, a ring whose arc is the
share, a captured product surface, a diagram of a flow, a map, a photograph of the thing, an SVG that
draws on so a relationship becomes visible.

Same rule as for backgrounds ([show-real-thing](../rules/show-real-thing.md)): a moving backdrop does not excuse an empty frame, and a decorated frame
does not excuse an unillustrated claim.

## Find the thing in your content that wants a picture

Go through the script line by line ([graphic-is-subject](../rules/graphic-is-subject.md)). Five claim shapes want a graphic, each a specific one. A line that is
none of them is fine as type.

| the claim is | it wants | because |
|---|---|---|
| a quantity ("4.2 million requests") | a bar or column whose length is the figure; a count-up beside it, never instead of it | a number in type is a word; a bar is a size the eye compares without reading |
| a proportion ("83% of them") | a ring, an arc, a stacked bar, a filled grid of units | the missing 17% shows in a ring and hides in a numeral |
| a change over time ("down from 40 s to 2 s") | a line, a sparkline, a before and after held side by side | the shape of the fall is the argument |
| a relationship or flow ("routes through three checks") | a diagram, a step flow, a map, nodes and connectors that draw on | order and dependency have no typographic form |
| a real thing (the product, the page, the person, the place) | the real surface: a capture of the live UI, a photo, a clipped screenshot | the thing itself beats a description of it |

A captured real surface outranks a chart you drew. If the claim is about the product, show the product:
real gradients, real copy, real logos, no fabrication. If nothing in a beat is any of the five, ask
whether the beat has a point. A beat that names a quantity and does not show it asks the viewer to do the
picturing. The honest fix is usually to find the number the claim rests on.

## The graphic must be the subject, not a garnish

A small logo beside a headline is punctuation, not a picture. The floor below which a graphic reads as a
mark is in [graphic-is-subject](../rules/graphic-is-subject.md). Treat it as a floor. If the graphic is the
point of the beat, it owns the frame: hero scale, type demoted to a caption. One huge thing and one small
label reads as designed. A chart and a headline at one weight reads as a slide. A picture sitting behind
the content is scenery. If it is the explanation, bring it forward.

## Three questions to ask by hand

1. Is there one carrying graphic in the whole film: large enough to be the subject of its beat? More
   glow moves nothing.
2. How much of the running time has one on screen? Under a third and the film leans on type.
3. Which beats hold nothing but type? Name them, then ask what each could show.

None of this proves the picture explains anything. A big decorative photograph passes all three, and so
does a bar chart of a number nobody cares about. That judgement is yours and the fresh critique's. A film
whose whole idea is type on a field is a legitimate answer, decided on purpose and defended. It is not an
answer to "I could not think of one".

## Where the graphic comes from

- Captured UI of the live product (`guides/REFERENCE-STUDY.md` for the capture rules).
- A bespoke SVG for a diagram: SVG draw-on and morph ([after-effects-techniques.md](after-effects-techniques.md)).
- Photos and logos: [imagery.md](imagery.md) for sourcing, treatment and licence. Never embed copyrighted stills.

Density ([density.md](density.md)) is the neighbouring rule: is the frame full enough to look produced. This one asks
whether anything in it does the explaining. A frame can pass density on three text elements and still
show nothing.

## A product screen is designed for the video, not a plain mock

A capture of the real product beats a mock ([show-real-thing](../rules/show-real-thing.md): no fake product UI). This part is for the screen you must build. A hand-written mock defaults to a grey window, small type and a sparse grid, because that is what "a UI" looks like in training data; the reference films do the opposite (large type, few elements, real imagery, the subject filling the frame; numbers in [density.md](density.md)).

- One focal element per screen (the prompt in an editor, the hero tile in a grid). A named domain signature beats a generic dashboard template.
- Fill most of the frame. Display-size type, never web-size.
- Real images shown whole. Set each cell to the source's own aspect ratio so `object-fit: cover` neither crops nor letterboxes. A crop that cuts the stills' own on-screen text reads as a bug.
- Colour from theme tokens (`var(--...)`), one accent. A dark capture goes on a dark surface. A relative `<img src>` resolves against the page that loads it, not the fragment.
- "You choose" a theme means invent one (`bin/vawe new` puts a seed with its mood in the brief). Take principles from the smallest useful ui-skills set, never its font or colour defaults: the local theme's tokens win.
- Every claim in on-screen copy must be true. A results title that said "six films shipped this week" when nobody had was replaced with the storyboard's own copy.
- Check the laid-out page, not the source. Fill and detail statistics cannot see composition: a title cut in half and a title fully on screen can score the same. A percentage width, a grid track and an `object-fit` crop resolve only after layout, so render the fragment and read each element's real box against the frame and the safe margin ([safe-margin](../rules/safe-margin.md)). Outside the frame is a defect, inside the margin a warning.
