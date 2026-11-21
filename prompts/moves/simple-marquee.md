# Simple marquee

**Use when** a film shows a crowd, a team or a list of names that is longer than the frame: contributors, customers,
guests. Rows of name tags drift past in opposite directions. Clip: [simple-marquee.mp4](clips/simple-marquee.mp4). Demo:
[demo/simple-marquee.html](demo/simple-marquee.html).

Look: the flat neutral ground and a centred heading. Three lanes of white name tags with a hairline ring and a faint shadow.
Each tag has a round initial in a pale tint, a name in semibold and a role in muted grey, all at 3.4 u or more. The lanes
fade at the left and right edges. The names are invented people.

How it moves: the heading and the lanes fade in with a 1.2 vh rise (110 ms between lanes). Then each lane drifts at 9 u a
second, the lanes in alternating directions. A marquee runs at one speed, so the drift has no ease and is a function of
the seek time. The whole stage leaves on `leave`.

```js
const SPEED = 9;                                          // u a second; the rows run at one speed, so no ease
window.seek = (t) => rows.forEach((row, i) => { row.style.translate = `${ROWS[i].dir * SPEED * u * t}px 0`; });
arrive(lane, 150 + r * 110, { ms: 300, from: '1.2vh' });   // the lane, not the row, so the drift keeps the row's translate
```

Sound: none.

Common mistake: tiles that are only gradients. They read as colour blobs and say nothing. Give each tag real content (an initial, a
name, a role) at a readable size, and keep every row the same height and gap so the loop is clean.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
