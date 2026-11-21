# Notification pop

**Use when** the product tells the user something finished: a render, a payment, a message. A copy
of a real phone notification banner: a phone with a photo wallpaper and a home screen, and a banner
with the app icon, a bold title, the time (`now`), a two-line body and the small grab handle. The
banner is a translucent material over a blurred backdrop. It drops from above the screen on a
spring with a small settle, is read for about three seconds, then swipes up and out. Clip:
[notification-pop.mp4](clips/notification-pop.mp4) (5.6 s, light; `notification-pop-dark.mp4` is the dark
theme). Demo: [demo/notification-pop.html](demo/notification-pop.html).

```js
import { track } from '../../core/motion/springs.js';
import { easeFn } from '../../core/motion/presets.js';
// the system spring: stiffness 300, damping 26 (ratio 0.75, about 3 percent settle); the banner starts fully above the screen
// the position is a pure function of t, set each frame (see the note below)
const ms = t * 1000, clamp = (x) => Math.min(1, Math.max(0, x));
const exit = clamp((ms - 4400) / 320);                      // the swipe out is shorter and accelerates: 320 ms, the launch ease
const drop = exit > 0 ? 200 * easeFn('launch')(exit) : 200 * (1 - track(t, [[0, 0], [0.9, 1]], 300, 26));
banner.style.translate = `0 ${-drop}%`;                      // percent of the banner's own height
```

```css
.banner { background: rgba(246, 246, 246, 0.74); backdrop-filter: blur(30pt) saturate(1.8); border-radius: 26pt; }   /* pt = screen width / 393 */
```

Sound: droplet when the banner lands (about 0.2 s after it starts); nothing on the swipe.

## How it looks and moves

- Real proportions, in points of a 393 pt wide screen: banner inset 12 pt, top 56 pt (under the
  Dynamic Island), radius 26 pt, padding 14 by 16 pt, icon 38 pt with a 9 pt radius, title 15 pt
  semibold, body 15 pt, `now` 13 pt. The phone is 118 u wide (118 percent of the frame height) and
  runs off the bottom of the frame, so the banner text reads at 4.4 u.
- The screen is a wallpaper photo, a status bar, the Dynamic Island and twelve generic apps (flat
  colour, one white glyph). Our own app icon, title and file name: no real app or brand.
- Only the banner moves. The contents do not stagger: the real banner arrives as one object.
- The phone fades in and out as clip framing.
- The banner is driven by `vawe.onFrame`, not by a WAAPI animation: a `translate` animation on an element with `backdrop-filter` does not show in the rendered clip until it ends.

Common mistake: a banner that scales or fades in with the same ease it leaves with. It drops on the spring and leaves on the launch ease, shorter than it came.

Inter stands in for the system face.
