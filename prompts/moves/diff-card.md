# Diff card

**Use when** a code review or a merged change is the proof. A copy of a GitHub pull request, Files changed tab, in a Chrome window: the page is already there (GitHub does not animate its rows in), the checks chip swaps from pending to passed in one frame, the Open badge and its sentence swap to a purple Merged badge in one frame, and the reviewer ticks Viewed. Clip:
[diff-card.mp4](clips/diff-card.mp4) (6 s, light; `diff-card-dark.mp4` is the dark theme). Demo: [demo/diff-card.html](demo/diff-card.html).

```js
import { arrive, show, leave } from '../../prompts/moves/demo/assets/stage.js';
// only the window arrives (clip framing); the page inside is whole
arrive(win, 100, { ms: 220, from: '0.8vh' });
// checks at 2.7 s, merge at 3.3 s: old and new swap on one frame
show(pending, null, 2700); show(passed, 2700);
show(open, null, 3300); show(merged, 3300);
show(viewedTick, 4200);   // the tick appears at once
```

Sound: none. The clip is silent.

The clip copies GitHub: the top bar with the mark, the repo tabs with Pull requests selected, the title with the number, the state badge (green Open, purple Merged), the sentence "wants to merge 4 commits into main from branch", the PR tabs with count pills and the green and red diffstat squares, and a file card with its hunk header, gutters, syntax colours, added and removed rows and the changed words darker. Colours are GitHub's light and dark themes; Inter stands in for the system face. The diff text is 2.6 percent of the frame height (the browser window is drawn 13 percent larger than the measured 65.6 percent share). The content is our own (a cache for invoice totals, +86 -19, 3 files). Nothing overshoots: GitHub swaps its badge and its checks instantly. The still window before the merge is declared with its measured seconds. One difference from the product: ticking Viewed would collapse the file in GitHub; the clip keeps it open so the diff stays the proof.
