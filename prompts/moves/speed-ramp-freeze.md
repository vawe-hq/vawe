# Speed ramp freeze

**Use when** a beat needs weight before a change: motion slows to a near hold on the hit frame, then snaps on at more
than full speed. It is a time remap, not an easing: story time is the integral of a speed curve, so the ball, its squash
and the camera push all slow, stop and restart together. Clip: [speed-ramp-freeze.mp4](clips/speed-ramp-freeze.mp4). Demo:
[demo/speed-ramp-freeze.html](demo/speed-ramp-freeze.html).

Look: a matte terracotta ball on a warm bone floor, lit by one soft key light from the top left (a gentle radial shade, no
highlight dot). The only other thing is the ball's soft contact shadow, which grows and fades with its height. The ball
squashes on landing and stretches as it leaves. A vertical blur follows the real-time speed.

How it moves: the ball falls from above the frame. Speed ramps from 1 to 0.03 in 0.4 s (the freeze, with a 5 percent push
in), holds 0.25 s on the deepest squash, snaps to 3.5 and settles to 1. Then the ball bounces three times, each lower. Rises
use `EASE.land`, falls use `EASE.launch`, the squash uses `EASE.settle`. The ball rests for over a second and leaves with the floor.

```js
const T = { ramp: 0.35, rampLen: 0.4, hold: 0.75, snap: 1.0 }, FREEZE = 0.03;   // seconds of real time
const speed = (t) => t < T.hold ? 1 - (1 - FREEZE) * smooth((t - T.ramp) / T.rampLen)   // smooth: easeFn('settle')
                  : t < T.snap ? FREEZE : 1 + 2.5 * Math.exp(-(t - T.snap) / 0.1);
// tau: story time, the integral of speed in 1/240 s steps, read by interpolation; every position is a function of p = tauAt(t)
const BOUNCES = [{ h: 1, up: 0.9, down: 0.55, amp: 0.6 }, { h: 0.3, up: 0.38, down: 0.3, amp: 0.3 }, { h: 0.08, up: 0.2, down: 0.16, amp: 0.12 }];
// rise: RISE * b.h * land(u); fall: RISE * b.h * (1 - launch(u)); the fall to the floor is DROP * (1 - launch(p / TOUCH))
world.style.scale = 1 + 0.05 * clamp(1 - speed(t));                              // the push follows the slow-down
```

Sound: droplet on the first contact, at 1.0 s (default gain); a quiet tick on each later bounce.

Common mistake: a fall written as `y = (p / touch) ** 2`. It is a hand-fitted curve and skips the named eases. Use `EASE.launch` for a fall and
`EASE.land` for a rise, and freeze on a contact: a freeze with nothing to hit reads as a dropped frame.

Looks (ground, type, radius, accent) live in `demo/demo.css`; this snippet keeps neutral tokens.
