# Device tilt stage

**Use when** the product should be seen as an object: the UI sits on a laptop screen, and the
camera comes down from a steep view above the keyboard to a three-quarter view and stops. The
laptop is a real CSS 3D object: an aluminium body with a keyboard deck (black keys in ANSI rows, a
trackpad, a hinge), a thin lid with a black bezel, a notch and a menu bar, and a real app on the
screen. A soft shadow lies on the table under it. Clip:
[device-tilt-stage.mp4](clips/device-tilt-stage.mp4) (4.2 s, light; `device-tilt-stage-dark.mp4` is the
dark theme). Demo: [demo/device-tilt-stage.html](demo/device-tilt-stage.html).

```js
// the camera is the only thing that moves: one long ease from above the keys to a three-quarter view
const u = easeFn('settle')(clamp((t - 0.2) / 2.0));
cam.style.setProperty('--rx', lerp(-58, -19, u));   // pitch: the camera drops toward the deck
cam.style.setProperty('--ry', lerp(-36, -9, u));    // yaw
cam.style.setProperty('--s', lerp(0.86, 1.06, u));
// the render bar on the screen runs on while the camera settles (a pure function of t)
arrive(stage, 100, { ms: 220, from: '0vh' });       // the stage fades, not the 3D object
```

Sound: none. The clip is silent.

## How it looks and moves

- Body: light aluminium deck with a lit edge, a darker front face and side faces (3.2 u thick),
  black keys with a top highlight, a trackpad outline, a dark hinge strip. The lid is 1.6 u thick,
  leans back 15 degrees, with a thin black bezel and a notch cut into the menu bar.
- Screen: our own app in the product look (menu bar, side list, three renders, a progress bar).
  Text on it is 2.3 u or more and the laptop fills about 65 percent of the frame width at rest, so it reads at rest and from 1.5 s on, when the scale is already about 0.97. It does not read in the first 1.0 s while the camera is steep.
- The camera has no overshoot and no bob: a laptop on a table does not float. Only the progress bar
  and its percentage move after the camera stops.
- The shadow is a real blurred plane on the table that turns with the body.

## The common mistake

An opacity or filter animation on a `preserve-3d` element flattens it: the deck vanishes and the lid
looks wrong. Fade the flat parent (the stage that holds the perspective), never the 3D object.
