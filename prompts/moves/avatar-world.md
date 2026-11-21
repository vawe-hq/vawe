# Avatar world

**Use when** a person, a brand or a place is the way into a picture: a profile, a creator page. On a real profile page a press on the avatar opens its picture large over the dimmed page. The picture grows from the avatar to the middle of the page, so the avatar is the way into the larger world. Clip: [avatar-world.mp4](clips/avatar-world.mp4) (4.4 s). Demo: [demo/avatar-world.html](demo/avatar-world.html).

```js
// FLIP: the big picture sits centred at its end size; it starts on the avatar
const dx = avatarCentre.x - bigCentre.x, dy = avatarCentre.y - bigCentre.y, s0 = avatar.width / big.width;
big.animate([{ opacity: 1, translate: `${dx}px ${dy}px`, scale: s0 }, { opacity: 1, translate: '0 0', scale: 1 }],
  { duration: 300, delay: 1800, easing: EASE.land, fill: 'both' });          // no overshoot
dim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 1800, easing: EASE.land, fill: 'both' });
```

Sound: none; one soft tick on the press is the only cue a film needs.

## How it looks and moves

- The clip copies a social profile page in a browser window: a photo banner, the avatar overlapping the banner with a white ring, action buttons (more, message, Follow), name, handle, bio, place and link, the counts row (Following, Followers) and the tabs (Posts is active, with a blue underline). The person, the handle and the numbers are our own.
- The avatar is a flat vector illustration (sun, sea, a sail), never a photo of a real person, so it stays sharp when it grows.
- The page is already loaded: only the window arrives, and no row animates, as on a real profile.
- A pointer comes from the lower right (0.9 s, `EASE.land`), presses the avatar at 1.7 s (the pointer dips to 86 percent for 0.2 s), and the viewer opens 0.1 s later.
- The viewer is the real one: the picture grows to 62 u in 0.3 s with no spring, the page behind dims to black at 90 percent, a close button fades in. The page does not scale.
- The pointer then goes to the close button (0.45 s, `EASE.land`) and presses at 2.95 s; the picture shrinks back into the avatar in 0.24 s on `EASE.launch` and the page undims. The clip does not hold a static viewer.
- Common mistake: a viewer that grows from the middle of the page, or from nowhere. It must grow from the avatar's own rectangle (FLIP) and return to it, so the avatar stays the way in and the way out.
- The window and the pointer leave at the end of the clip.
