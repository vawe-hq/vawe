---
when: changing the studio UI, adding a panel, or working out where its code lives
answers: "what studio/ is: the local live preview for a page film, and where its server, source editor and UI live"
group: engine
---

# studio/

The live scrubbable preview for one page film: a static server that serves the page with the render
clock installed, a scrub bar, and in-place editing of the page's tunable literals.

```
bin/vawe dev films/<name>/page.html --studio [--port 8799]
```

Open the printed URL, leave it running (Ctrl-C to stop). The page is seeked, never played, by the
same clock and seek code the renderer uses (`core/engine/page-clock.js`, `core/engine/page-seek.js`).

## Layout

```
studio/
  page-server.mjs   the http server: serves the page framed by aspect, the edit and undo routes
  page-source.mjs   parses the page (acorn) into its tunable literals and applies an edit in place
  chat.mjs          the chat routes the studio UI talks to
  ui/
    page-studio.html  the markup
    page-studio.css   the styling
    page-eases.js     the named eases: read from the page, written in the form each place takes, curve samples
    page-ease-menu.js the ease picker: a curve per ease, hover or focus tries it in the preview, a click writes it
```

A tunable is a literal in the page: a `[[f, v], ...]` table, a `@keyframes` stop, an
`element.animate` keyframe or a `:root` custom property. The studio changes that text and nothing
else, so a save that changes nothing is a zero-byte diff.
