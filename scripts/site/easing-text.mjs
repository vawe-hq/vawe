// The words on /easing/<slug>: what each ease is for, and when to leave it alone. The numbers come
// from scripts/site/easing.mjs, never from here: vaweWords takes them as arguments.

export const VAWE_TEXT = {
  land: {
    blurb: 'An entrance: it leaves fast and arrives on a long, soft stop.',
  },
  'land-soft': {
    blurb: 'An entrance for short moves: a gentler start than land, the same long stop.',
    avoid: ['Hero moves over 0.6 s. The softer start loses the punch that land has.', 'Exits. Use launch or leave.'],
  },
  settle: {
    blurb: 'Eases at both ends, with long dead stops: it starts and ends at rest. It is for 0.5 s or more, and for a camera only at 2 s or more. A camera under 2 s takes land.',
  },
  swap: {
    blurb: 'A swap: the value waits at each key and changes in the middle.',
  },
  glide: {
    blurb: 'A slow drift: it starts gently and never fully stops.',
  },
  carry: {
    blurb: 'It starts gently and is still moving fast at the end, so the next key can carry on.',
    use: ['A move that runs into a cut or a wipe, where the speed should pass to the next shot.', 'Carousels and orbits with keys one after another.'],
    avoid: ['A move that must come to rest. It ends at speed and looks cut off.', 'Moves with no next move to take the speed.'],
  },
  leave: {

  },
  launch: {
    blurb: 'An exit that starts gently and speeds up, at most 3x average at the cut.',
  },
  pop: {
    blurb: 'A fast start, then it passes its mark by about 15 per cent and settles back.',
    avoid: ['Text blocks and anything with more than one item moving: overshoot on many things reads as shaking.', 'Opacity. A value past 1 is clamped, so the overshoot does nothing.'],
  },
  snap: {
    blurb: 'A snap: 80 per cent of the travel by a fifth of the move, then a long, soft stop. Fast kinetic type moves this way.',
    use: ['Kinetic type that lands in 1 to 3 frames, as in fast type films (median move 0.3 s).'],
    avoid: ['A camera move. A camera takes land under 2 s, and settle or glide at 2 s or more.'],
  },
  nudge: {
    blurb: 'A fast start, a slight pass of its mark, then it settles.',
    use: ['Every few items of a staggered group, so the row feels alive without each item bouncing.', 'Secondary elements next to a hero that uses pop: the same shape, less of it.'],
    avoid: ['The hero itself, where the overshoot is too small to read. Use pop.', 'Opacity. A value past 1 is clamped, so the overshoot does nothing.'],
  },
};

export const FAMILY = {
  sine: { feel: 'The gentlest family: the speed changes slowly.', use: 'ambient loops, slow camera drift and background layers', avoid: 'moves that must hit hard: the stop is too gentle' },
  quad: { feel: 'A mild, even curve.', use: 'small UI changes and hover states', avoid: 'hero moves: the stop is too soft' },
  cubic: { feel: 'A firm start or stop. The common default.', use: 'general UI and card moves between 200 and 500 ms', avoid: 'long travel across the frame: the stop is abrupt for the distance' },
  quart: { feel: 'A strong ease: most of the travel happens in the fast section.', use: 'panels and overlays that need a clear stop', avoid: 'short moves under 150 ms: the slow part is too short to see' },
  quint: { feel: 'A very strong ease: almost vertical at the fast end.', use: 'large elements that should settle with weight', avoid: 'small elements: they seem to teleport and then crawl' },
  expo: { feel: 'An extreme ease: one tenth of the time carries most of the travel.', use: 'a title or number that must snap in and then rest', avoid: 'anything the viewer must follow with the eye: the fast section is too short to track' },
  circ: { feel: 'A circular arc: it starts or stops almost vertically.', use: 'mechanical moves and wipes with a hard edge', avoid: 'soft, organic motion: the stop feels cut' },
};

export const DIRECTION = {
  in: { role: 'It starts slowly and ends fast.', use: 'exits and build-ups that leave the frame at speed', avoid: 'entrances: the first frames barely move, so the viewer waits' },
  out: { role: 'It starts fast and ends slowly.', use: 'entrances and replies to a click, where the thing should respond at once and then settle', avoid: 'loops: it stops dead at the end and has no speed to hand on' },
  inOut: { role: 'It is slow at both ends and fast in the middle.', use: 'moves between two resting positions: camera pushes, slides and loops', avoid: 'quick UI feedback under 200 ms: the slow start delays the response' },
};

// back, elastic and bounce are written by hand: the direction decides what they do.
export const SPECIAL = {
  'ease-in-back': { feel: 'It pulls back below its start, then launches.', use: ['An exit that winds up first: the element pulls back, then goes.', 'A button press or a throw, where the pull-back is the message.'], avoid: ['Entrances. The element first moves the wrong way and the viewer sees a glitch.', 'Opacity: a value below 0 is clamped, so the wind-up is lost.'] },
  'ease-out-back': { feel: 'It passes its end value, then settles back.', use: ['A card or badge that arrives and overshoots its place, then settles.', 'Playful UI: toggles, chips and toasts.'], avoid: ['Text blocks and tables: the overshoot reads as a layout error.', 'Opacity: a value above 1 is clamped, so the overshoot does nothing. Use pop on scale.'] },
  'ease-in-out-back': { feel: 'It pulls back at the start and passes the end, then settles.', use: ['A move with a wind-up and an overshoot: a mascot, a sticker, a toy-like object.'], avoid: ['Anything formal: the element moves backward at both ends.'] },
  'ease-in-elastic': { feel: 'It rings around its start, then jumps to the end.', use: ['A charge-up before a release, shown on one element.'], avoid: ['Entrances and exits that must read cleanly: the element swings before it moves.'] },
  'ease-out-elastic': { feel: 'It jumps to the end and rings around it like a rubber band.', use: ['A single logo or badge that lands with a wobble, for a game or a kids brand.'], avoid: ['Text, lists and most product UI: the ringing lasts too long, and it needs 0.8 s or more to be seen.'] },
  'ease-in-out-elastic': { feel: 'It rings at both ends and crosses in the middle.', use: ['A toy-like transition on one object.'], avoid: ['Everything with more than one moving part: the ringing at both ends doubles the noise.'] },
  'ease-in-bounce': { feel: 'It hops with growing height, then leaves fast.', use: ['A wind-up with hops before a fast exit, in a playful film.'], avoid: ['Anything that must look clean: the hops at the start look like frame drops.'] },
  'ease-out-bounce': { feel: 'It drops to the end and rebounds with shrinking hops.', use: ['An object that drops into place and rebounds: a ball, a coin, a sticker.'], avoid: ['UI that should feel quick: the rebounds hold the final value back for most of the move.'] },
  'ease-in-out-bounce': { feel: 'It hops at both ends and crosses in the middle.', use: ['A toy-like pass across the frame that hops at both ends.'], avoid: ['Nearly everything else: two sets of hops make one clean move impossible.'] },
};

export const CSS_TEXT = {
  linear: {
    blurb: 'Constant speed from start to end.',
    use: ['Rotation spins, progress bars and loops, where a steady speed is the point.', 'Opacity cross-fades between two shots.'],
    avoid: ['Moving a thing across the screen: it starts and stops with no ease, so it reads as mechanical.', 'Any entrance or exit over 0.3 s. Use an EASE name from vawe.'],
  },
  ease: {
    blurb: 'The CSS default: a quick start and a long, soft end.',
    use: ['A first pass on a UI change when you have not chosen a curve.', 'Hover and focus changes under 300 ms.'],
    avoid: ['Film moves over 0.3 s: it is the browser default, not a choice. Use land or settle.', 'Loops. It ends slowly and starts fast, so a repeat shows a seam.'],
  },
  'ease-in': {
    blurb: 'Slow start, fast end, no soft stop.',
    use: ['An element leaving the screen, where it should be fastest as it goes.', 'A build-up before a cut.'],
    avoid: ['Entrances: the start is slow and the viewer waits.', 'A move that must end at rest: it stops dead at full speed.'],
  },
  'ease-out': {
    blurb: 'Fast start, slow end.',
    use: ['Entrances and replies to a click, where the response should be at once.', 'Short UI moves of 150 to 300 ms.'],
    avoid: ['Moves over 0.5 s: the long slow tail looks like the element is stuck.', 'Exits: it is slowest as the element leaves.'],
  },
  'ease-in-out': {
    blurb: 'Slow at both ends, fast in the middle.',
    use: ['Moves between two resting positions: a slide, a camera push, a toggle.', 'Looping back-and-forth motion.'],
    avoid: ['Quick UI feedback: the slow start delays the response.', 'Film entrances. Land gives a clearer arrival.'],
  },
};

// The words that quote a computed number (the test of 5 moves, 2026-10-19); they replace VAWE_TEXT's fields of the same name.
export const vaweWords = ({ firstFrame, REAL_FIRST_FRAME, lateStart, STATS, EXIT, sec, EXIT_EXAMPLE, EXIT_FALLBACK, span, BANDS, popPeakAt, popSettleFrames, FPS, SEND }) => ({
  land: {
    use: ['Entrances of titles, cards and panels from 0.5 to 0.8 s. It is the default of enter().', 'A camera move under 2 s that must arrive, such as a pull-back: it settles in the first quarter.'],
    avoid: [`Staggered rows under 0.4 s: at 0.3 s the first frame jumps ${firstFrame('land', 0.3)}% of the way. Use land-soft (${firstFrame('landSoft', 0.3)}%).`, 'Exits and loops. It ends on a dead stop and starts at full speed, so it does not chain.'],
  },
  'land-soft': {
    use: ['Entrances of 0.15 to 0.4 s: list rows, labels, small UI.', `A copied product move: a real surface covers ${REAL_FIRST_FRAME[0]} to ${REAL_FIRST_FRAME[1]}% in its first frame, and land-soft gives ${firstFrame('landSoft', 0.3)}% at 0.3 s.`],
  },
  settle: {
    use: ['Scan or wipe travel of 0.5 to 1 s: the line starts and ends at rest.', 'Big or heavy objects crossing the frame in 0.5 to 1 s: panels, full-width bars, device frames, a camera pull of 2 s or more.'],
    avoid: [`Moves under 0.5 s and camera moves under 2 s: both ends are slow, so the dead start wastes the first ${lateStart('settle')}% of the move. Use land.`, 'Small, quick UI. A 0.2 s move spends most of it standing still.'],
  },
  swap: {
    use: ['The value change: a label, a number, a tab, a crop, in 0.15 to 0.4 s.', 'Camera cuts on the move, where you want a crisp hit and a hold on both sides.'],
    avoid: ['Scan or wipe travel, and any long distance. The middle is steep, so the line becomes a blur. Use settle.', 'Slow, floating motion. It is the opposite of a drift.'],
  },
  glide: {
    use: ['Camera pushes and slow scale on a held shot, over 2 s or more.', 'A background layer behind a still title, where motion must be felt and not followed.'],
    avoid: ['Camera moves under 2 s: the slow tail needs time to be seen. Use land.', 'Entrances. There is no clear arrival, so the viewer cannot tell when the thing has landed.'],
  },
  leave: {
    blurb: 'A decelerating exit: it eases away and slows into its end. The house exit is launch.',
    use: ['An exit that is a settle or a hand-off into the next shot, when the page says so.', `Outside reference: ${STATS.exitSegments - STATS.exitsFasterThan15} of ${STATS.exitSegments} Lottie exits end at 1.5x the average or slower.`],
    avoid: [`A plain exit. Exits run ${EXIT.exit_share_min} to ${EXIT.exit_share_max} of the entrance and accelerate: use launch.`, 'Entrances. It is built to finish, not to start.'],
  },
  launch: {
    use: [`The default exit, ${EXIT.exit_share_min} to ${EXIT.exit_share_max} of the entrance (${sec(EXIT_EXAMPLE.exitMs / 1000)} s after a ${sec(EXIT_EXAMPLE.entranceS)} s one), or ${span(...EXIT_FALLBACK)} when the entrance length is unknown: opacity 1 to 0 while it moves out. leave() uses it.`, 'Wipes and clears that hand the frame to the next beat.'],
    avoid: ['Any move that has to land. It ends at speed.', 'A settle or a hand-off the page names: use leave.'],
  },
  pop: {
    use: [`A call to action, a check mark, a corner notification that slides in over more than 20 px: one small thing that must feel alive, in ${span(...BANDS.gravity)}.`, `The peak comes at ${Math.round(popPeakAt * 100)}% of the move: a 0.5 s pop leaves ${popSettleFrames(0.5)} frames of settle at ${FPS} fps. For a small item that moves 3 to 20 px (a bubble, a chip, a tip) use the send spring instead (k ${SEND.k}, d ${SEND.d}).`],
  },
});
