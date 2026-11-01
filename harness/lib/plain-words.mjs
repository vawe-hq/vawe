// Plain words for text a person reads (boards, questions). Agent-facing text keeps the harness terms.
export const PLAIN = {
  world: 'scene',
  shot: 'scene',
  spectacle: 'the big moment',
  cut: 'change of scene',
  'hard cut': 'straight cut',
  strip: 'a row of frames',
  beat: 'a moment',
  handoff: 'how one scene leads to the next',
  'live-hold': 'keep something moving while text is on screen',
  register: 'line up the two inks',
  rhythm: 'timing',
  ease: 'speed curve',
  'motion pass': 'movement check',
};

export const plain = (term) => PLAIN[term] ?? term;

export const BOARD_LABELS = {
  scenes: 'scenes',
  bigMoment: 'big moment',
  timing: 'timing',
  sceneChange: 'scene change',
  sceneChangeLength: 'scene change length',
  straightCut: PLAIN['hard cut'],
  cut: PLAIN.cut,
  speed: PLAIN.ease,
  movementCheck: PLAIN['motion pass'],
  fromDocs: 'from the docs',
  easeDial: 'the film\'s usual speed curve',
};
