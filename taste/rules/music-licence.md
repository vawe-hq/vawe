---
id: music-licence
step: sound
principle: Only music whose licence we can produce goes under a film.
limit: only CC0 and CC BY music; never CC ND; CC NC is unsafe for client or paid work
range: Pixabay (keep the certificate); Mixkit free tier (commercial use, no redistribution of the file); never quote vendor sonic-branding multipliers
break-when: never
instead: read the contract of a subscription library before buying; add the destination channel to the safelist before posting; use AI-generated music (not copyrightable when purely prompt-made) for internal animatics only. assets/music/ is gitignored; record every track in assets/music/credits.json.
more-explore: use only CC0 or CC BY music you can show a licence for and log it in assets/music/credits.json, not CC ND or CC NC
check: none
judge: Does every track have a recorded source and licence?
prevents: doc SOUND: a wrong track gets a Content ID claim on upload; committing a Mixkit file would publish it as a standalone download.
status: active
scored: no
numbers: {}
craft: sound
---

## Example

credits.json lists the Pixabay URL and licence for track.mp3.

Why and sources: [sound](../craft/sound.md).
