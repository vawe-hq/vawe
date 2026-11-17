// Every next-step text a producer prints, rendered with fixed inputs. The fixture next-text.json holds the text as it was
// before next steps became data: the renderer must reproduce it byte for byte.
import { SAY, briefStep } from '../../harness/live/stage-say.mjs';
import { SHOW_PLAN, SHOW_OWNER, shipProblem, planProblem } from '../../harness/lib/approval.mjs';
import { critiqueCommand, critiqueFreshCommand } from '../../harness/lib/critique-gate.mjs';
import { VERBS } from '../../harness/cli/verbs.mjs';
import { doneLines } from '../../harness/lib/ship-status.mjs';
import { openItems, planStatusLines } from '../../harness/live/plan-status.mjs';
import { newFilmLines } from '../../harness/cli/new.mjs';

const REL = 'films/x/page.html';
const verb = (name) => VERBS.find((v) => v.name === name);
const nextLines = (lines) => lines.filter((l) => l.startsWith('next:')).join('\n');

/** The text of every producer, keyed by a stable name. */
export function cases() {
  const out = {};
  const put = (k, v) => { out[k] = v; };
  const say = {
    study: () => SAY.study('x'), moves: () => SAY.moves(), design: () => SAY.design('x'), skills: () => SAY.skills('x', ['type', 'colour']),
    states: () => SAY.states('x', REL), frames: () => SAY.frames('x', REL), ideas: () => SAY.ideas('x', REL), board: () => SAY.board('x', REL),
    cut: () => SAY.cut('x'), dev: () => SAY.dev('x', REL), motion: () => SAY.motion('x', REL), cutCheck: () => SAY.cutCheck('x', REL),
    motionRows: () => SAY.motionRows('x'), critique: () => SAY.critique('x', REL), plan: () => SAY.plan(REL, REL), ship: () => SAY.ship('x', REL),
  };
  for (const [k, fn] of Object.entries(say)) put(`SAY.${k}`, fn());
  const brief = briefStep('x');
  put('briefStep.next', brief.next);
  put('briefStep.why', brief.why);
  put('SHOW_PLAN', SHOW_PLAN);
  put('SHOW_OWNER', SHOW_OWNER);
  put('shipProblem', shipProblem(REL, { root: '/nonexistent-vawe-root', env: {} }));
  put('planProblem', planProblem(REL));
  put('critiqueCommand', critiqueCommand(REL));
  put('critiqueFreshCommand', critiqueFreshCommand(REL));
  const dev = verb('dev');
  put('devFix.slot', dev.fix('render slot busy', [REL]));
  put('devFix.lost', dev.fix('browser lost', [REL]));
  put('devFix.other', dev.fix('boom', [REL]));
  put('dev.next.animatic', dev.next({ animatic: true }, [REL]));
  put('dev.next.range', dev.next({ from: 1, to: 2 }, [REL]));
  const ship = verb('ship');
  put('ship.fix', ship.fix('x', [REL]));
  put('ship.next.wait', ship.next({ wait: true }, [REL]));
  put('ship.next.bg', ship.next({}, [REL]));
  const crit = verb('critique');
  put('critique.next.fresh', crit.next({ fresh: true }, [REL]));
  put('critique.next.plain', crit.next({}, [REL]));
  const refs = verb('refs');
  put('refs.next.addNoMeasure', refs.next({ 'no-measure': true }, ['add']));
  put('refs.next.frames', refs.next({}, ['frames']));
  put('refs.next.other', refs.next({}, ['index']));
  const see = verb('see');
  put('see.next.plan', see.next({ plan: true }, ['x']));
  put('see.next.sync', see.next({ 'sync-brief': true }, ['x']));
  put('see.next.plain', see.next({}, ['x']));
  const footage = verb('footage');
  put('footage.next.add', footage.next({}, ['add', 'x']));
  put('footage.next.log', footage.next({}, ['log', 'x']));
  const sound = verb('sound');
  put('sound.next.sfx', sound.next({ sfx: true }, ['x']));
  const frame = verb('frame');
  put('frame.next.fullworld', frame.next({ world: 'all', full: true }, [REL]));
  put('frame.next.cutsPage', frame.next({ cuts: true }, [REL]));
  put('frame.next.cutsRef', frame.next({ cuts: true }, ['abcdef12']));
  put('frame.next.moment', frame.next({ moment: 3 }, [REL]));
  put('frame.next.board', frame.next({ board: true }, [REL]));
  put('frame.next.directions', frame.next({ directions: true }, [REL]));
  const job = { id: 'j', page: REL, outputs: ['out/x.mp4'], problems: [], startedAt: 0, endedAt: 1000, verdict: null };
  put('doneLines.noVerdict', nextLines(doneLines(job)));
  put('doneLines.fixAcceptance', nextLines(doneLines({ ...job, verdict: ['judge: PASS'], acceptance: { allGreen: false, lines: [] } })));
  put('doneLines.judgeFail', nextLines(doneLines({ ...job, verdict: ['judge: FIX'] })));
  put('openItems', JSON.stringify(openItems({ rel: REL, brief: '## Look\n', design: '', early: true, frames: 'none', storyboardRan: false })));
  put('planStatus.findings', planStatusLines({ name: 'x', rel: REL, brief: '## Look\n', design: '', early: true, frames: 'ok', storyboardRan: true, findings: ['a', 'b'], next: 'n' }).join('\n'));
  put('newFilmLines.edit', nextLines(newFilmLines('x', { page: REL, route: { type: 'edit', template: 't', why: 'w' }, request: 'r' })));
  put('newFilmLines.plan', nextLines(newFilmLines('x', { page: REL, route: null, request: 'r' })));
  return out;
}
