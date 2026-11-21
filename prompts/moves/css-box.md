# CSS box

**Use when** a cuboid must turn to show another face: a product block with a message on each side,
a block that turns to the next fact. A solid matte blue block with six real faces, sharp lit edges,
big clean white type (12.5 u) on each side and a soft shadow on the table. It turns a quarter turn at a time on a
stiff, overdamped spring and stops with no overshoot. Clip: [css-box.mp4](clips/css-box.mp4) (5.6 s,
light; `css-box-dark.mp4` is the dark theme). Demo: [demo/css-box.html](demo/css-box.html).

The spring values (stiffness 100, damping 30) come from the CSSBox component of fancy by Daniel
Petho (MIT, [source](https://www.fancycomponents.dev/docs/components/blocks/css-box)). The faces,
the light and the look are our own.

```js
const STIFFNESS = 100, DAMPING = 30;                    // damping ratio 1.5: no bounce
const YAW = [[0, 0], [0.7, 90], [2.0, 180], [3.3, 270]]; // [second, degrees]: one jump of the target each
const yaw = REST + track(t, YAW, STIFFNESS, DAMPING);    // REST = -28 shows the front and one side
// light from the upper left front: a face is darker as its turned normal leaves the light
shade.style.opacity = 0.5 * (1 - Math.max(0, dot(normal, light)));
```

Sound: none; or one soft knock as each face lands (about 0.5 s after the jump).

## How it looks and moves

- Six faces in one `preserve-3d` block, each pushed out by half the edge (56 u, 56 percent of the
  frame height, about 75 percent on screen with the perspective). The camera looks down 17 degrees, so the top and two sides show.
- Faces are satin paint with a soft gradient across each face (lighter top left, darker bottom right) from one key light. The light comes from the upper left front, so the top is brightest and the
  right side darkest. A 0.16 u lighter line runs inside each edge. The shade is under the type, so
  the white stays white.
- A faint reflection of the block lies under it: a mirrored copy of the four sides at 0.13 opacity, each face masked to fade out away from the base. It carries no type.
- The contact shadow is a soft radial pool on the table, 1.8 times the edge wide, darkest under the block (0.55 alpha in light, 0.85 in dark).
- The block turns about its vertical axis only. Each jump is one quarter turn (half done in 0.2 s,
  still by 0.7 s). The order of the faces on screen is Build, Render, Edit, Ship.
- Only the stage fades in and out. An opacity animation on the 3D block would flatten it.

## The common mistake

Using an eased CSS transition: it stops dead at each target and cannot take a second jump in
flight. Use the spring on the angle. Also skip `backface-visibility: hidden` and the faces show
through the block. Never name a custom property `--edge` or `--surface` in a demo: `demo.css`
already owns them.
