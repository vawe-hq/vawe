# kinetic-promo beats

Navy ground, blue light bloom at the right edge, corner labels, chrome 4-point star, geometric sans.

Windows below are measured, not read off a contact sheet: `bin/vawe frame <ref-id> --cuts`
ran ffmpeg scene-detect (`select='gt(scene,0.3)'`) on the real 36.3s source and
grabbed one still per detected cut plus one per second into `study/stills/`. The 4 hard cuts it found
(5.45s, 7.67s, 19.27s, 21.28s, all scene score 1.0, the white/navy swaps) anchor the windows below;
the soft crossfades between hero words inside a shot do not spike ffmpeg's scene score, so those
sub-boundaries were set by looking at the per-second stills, not guessed from an assumed pace. Every
window was checked against its still before being written here.

## Beat 1: star spin intro
- window: 0.0-2.0s
- technique: chrome 4-point star (three/svgExtrude, metal preset) spins centred on navy+bloom ground, no text
- stills: study/stills/t0.00s.png, study/stills/t1.00s.png

## Beat 2: hero words blur-cycle
- window: 2.0-5.45s
- technique: single centred hero word per hold ("Clean" / "text" / "preset"), blur-in, weight change, turns blue; ends on the hard cut to white at 5.45s
- stills: study/stills/t2.00s.png ("Clean"), study/stills/t3.00s.png ("text"), study/stills/t4.00s.png ("preset")

## Beat 3: white invert sentence + star
- window: 5.45-7.67s
- technique: cut to white ground, "It's really easy to manage." builds word by word, chrome star sits beside it; ends on the hard cut back to navy at 7.67s
- stills: study/stills/t5.45s.png, study/stills/t7.00s.png ("It's really easy to manage.")

## Beat 4: two-line sentence
- window: 7.67-12.0s
- technique: back to navy, "Good text is unforgettable" builds two-line, per-word blue/white contrast
- stills: study/stills/t9.00s.png, study/stills/t11.00s.png ("Good text is unforgettable")

## Beat 5: falling motion-blur line
- window: 12.0-15.0s
- technique: "Will make your video more expensive" words fall in with directional motion blur, navy ground
- stills: study/stills/t12.00s.png ("Will make your video"), study/stills/t14.00s.png ("more expensive")

## Beat 6: rising motion-blur line
- window: 15.0-19.27s
- technique: "leave your message" letters rise with directional motion blur, navy ground; ends on the hard cut to white at 19.27s
- stills: study/stills/t16.00s.png ("leave"), study/stills/t17.00s.png ("your"), study/stills/t18.00s.png ("message")

## Beat 7: white invert payoff + star
- window: 19.27-21.28s
- technique: cut to white, "Really smooth." with a chrome star either side; ends on the hard cut back to navy at 21.28s
- stills: study/stills/t19.27s.png, study/stills/t20.00s.png ("Really smooth.")

## Beat 8: word-by-word colour reveal
- window: 21.28-24.5s
- technique: navy ground, "Clean. Simple. Attractive." revealed word by word, each word blue then settles
- stills: study/stills/t23.00s.png ("Clean. Simple. Attractive.")

## Beat 9: second sentence build
- window: 24.5-28.0s
- technique: navy ground, "we draw attention to something important" builds word by word, small chrome star fades in bottom-right
- stills: study/stills/t25.00s.png, study/stills/t26.00s.png ("something important")

## Beat 10: outro hero-word cycle
- window: 28.0-33.0s
- technique: "Just what I needed" collapses into single hero words cycling ("I" / "needed" / "Intro" / "style" / "animation"), same blur-cycle device as beat 2, doubling as the video's own title reveal
- stills: study/stills/t28.00s.png ("Just what I needed"), study/stills/t30.00s.png ("Intro"), study/stills/t31.00s.png ("style"), study/stills/t32.00s.png ("animation")

## Beat 11: end card
- window: 33.0-36.3s
- technique: "Thanks for watching!" builds word by word with per-word colour reveal (same device as beat 8), held to the clip's end
- stills: study/stills/t33.00s.png ("Thanks for"), study/stills/t34.00s.png ("Thanks for watching!")
