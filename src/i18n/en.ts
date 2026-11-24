const en = {
  nav: {
    course: 'Course',
    lessons: '{n, plural, one {# lesson} other {# lessons}}',
    progress: 'Progress',
    menu: 'Course menu',
    soon: 'soon',
  },
  theme: { toggle: 'Toggle dark mode' },
  lang: { label: 'Language' },
  home: {
    eyebrow: 'An interactive system design course',
    title: 'System design you can <em>watch</em>.',
    lede: 'Every lesson is a diagram you step through. Requests flow, servers fall over, caches soak up the load — and each step explains why the next box exists.',
    keys: '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> pause · <kbd>R</kbd> replay · <kbd>F</kbd> fit · drag to pan',
    start: 'Start',
    continue: 'Continue',
    review: 'Review',
    soon: 'Coming soon',
  },
  lesson: {
    of: 'Lesson {i} of {n}',
    min: '{n} min',
    steps: '{n, plural, one {# step} other {# steps}}',
    learn: 'You’ll learn',
    timeline: 'In this lesson',
    stepOf: 'Step {i} of {n}',
  },
  level: { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' },
  step: {
    label: 'Step {i} / {n}',
    back: 'Back',
    next: 'Next',
    nextTo: 'Next: {short}',
    finish: 'Finish lesson',
    changed: 'What changed',
    keys: '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>R</kbd> replay · <kbd>Space</kbd> pause',
  },
  stage: {
    replay: 'Replay',
    pause: 'Pause',
    play: 'Play',
    fit: 'Fit',
    hint: 'drag to pan · scroll or double-click to zoom',
  },
  chapter: {
    setup: 'setup', problem: 'problem', technique: 'technique', solution: 'solution',
    tradeoff: 'trade-off', insight: 'insight', recap: 'recap',
  },
  callout: { insight: 'Key idea', tip: 'Tip', warning: 'Watch out' },
  packet: {
    req: 'request', res: 'response', slow: 'slow', write: 'write',
    fail: 'failure', poison: 'bad traffic', ping: 'control',
  },
} as const;

export type UiMessages = { [K in keyof typeof en]: { [P in keyof (typeof en)[K]]: string } };
export default en;
