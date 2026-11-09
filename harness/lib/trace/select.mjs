const THROWAWAY_FILM = /^(zz|test|blogtest|blogdemo|probe|iter-test|demo|hello|x$|f$|t5|p\d|states-probe|stripdemo|moves-probe|board-probe|lhc-probe|ax-demo|phases-probe|ladder-probe|flow-probe|frames-trial|brief-trial|bar-|sig-|tmp|scratch|ts-)|-probe$|-test$|-check$|^fixtures$/;

/** A film agent wrote a film page or ran bin/vawe new for a film that is not a throwaway (zz-*, probes, trials), and drafted it with dev. */
export const isFilmAgent = (a) => a.filmAgent && 'dev' in a.stages.first && a.films.some((f) => !THROWAWAY_FILM.test(f));

/** An author is a film agent that started its film with bin/vawe new, not one that resumed, merged or tested films. */
export const isAuthor = (a) => isFilmAgent(a) && (a.started ?? []).some((f) => !THROWAWAY_FILM.test(f));

/** The agents a run keeps: --films (film agents), --authors (film agents that started their film), --agent (id or VAWE_AGENT label contains it), --since (started on or after). Pure. */
export function selectAgents(agents, { films = false, authors = false, agent = null, sinceMs = null } = {}) {
  return agents.filter((a) => (!films || isFilmAgent(a))
    && (!authors || isAuthor(a))
    && (!agent || `${a.agent} ${a.label}`.includes(agent))
    && (sinceMs === null || (a.start && Date.parse(a.start) >= sinceMs)));
}
