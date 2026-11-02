# moth-photogram

A 12 s, 16:9 loop: four moths orbit a light, rendered with three.js as a cyanotype photogram. No text, no sound. The message is "one pull of focus dissolves the near moth into light".

It teaches three things: wings as thin meshes bent in a vertex shader, a coupled creature-motion rig (wingbeat, body bob, bank and heading all derived from one orbit), and the one lens (palette, halation, real depth of field, rack focus) filming a WebGL canvas.

## Render

```
bin/vawe dev films/examples/moth-photogram/page.html
bin/vawe ship films/examples/moth-photogram/page.html
```

The draft is half size, 30 fps. `ship` needs approval first (`/vawe-approve`).

## Files

- `page.html`: the film (three.js scene, rig, lens call).
- `DESIGN.md`: the look. `brief.md`: task, motion study, board, motion pass.

## Sources

The motion numbers come from public sources, listed with their licences in `brief.md` ("Motion study"). No third-party footage is in this folder.
