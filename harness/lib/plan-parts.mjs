// Which parts of the plan a film has. A design film plans in Ideas and Board; an edit film (prompts/edit-from-clips.md) plans in the Cut list,
// and the parts only a designed film has (directions, reference study, DESIGN.md, Ideas, Board, slideshow and spectacle advice) do not apply to it.
import { sectionOf, filledRows, boardFilled } from './board.mjs';
import { ideasFilled } from './ideas.mjs';

export const EDIT_TEMPLATE = 'prompts/edit-from-clips.md';

/** True when the brief says it is an edit of the person's clips: its "Template:" line names the edit template. */
export const isEditFilm = (brief) => (brief ?? '').split('\n').some((l) => l.startsWith(`Template: ${EDIT_TEMPLATE}`));

/** False while a Cut list row has no `why` yet (a bracketed cell) or the list has no rows; null when the brief has no Cut list. */
export function cutListFilled(brief) {
  const section = brief ? sectionOf(brief, 'Cut list') : undefined;
  if (section === undefined) return null;
  const rows = filledRows(section).slice(1);
  return rows.length > 0 && rows.every((r) => !(r.split('|')[6] ?? '').trim().startsWith('['));
}

const DESIGN_ADVICE = [/^slideshow:/, /^spectacle at /, /^rule spectacle-weak /, /^signature unchosen/, /^attractor:/, /^directions:/, /^ideas/];

/** The advice lines that apply to this film: all of them for a design film, without the slideshow, spectacle, signature and attractor lines for an edit. */
export const adviceFor = (brief, lines) => (isEditFilm(brief) ? lines.filter((l) => !DESIGN_ADVICE.some((re) => re.test(l))) : lines);

/** The plan sections still empty before the first draft, in the order they are written: [{ title, skill }]. */
export function emptyPlanParts(brief) {
  if (isEditFilm(brief)) return cutListFilled(brief) === false ? [{ title: 'Cut list', skill: 'cut' }] : [];
  return [
    { title: 'Ideas', skill: 'ideas', empty: ideasFilled(brief) === false },
    { title: 'Board', skill: 'board', empty: boardFilled(brief) === false },
  ].filter((e) => e.empty);
}
