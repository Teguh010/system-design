const en = {
  'nav.course': 'Course',
  'nav.lessons': '{n} lessons',
  'nav.progress': 'Progress',
  'nav.menu': 'Course menu',
  'nav.soon': 'soon',
  'theme.toggle': 'Toggle dark mode',
  'lang.label': 'Language',

  'home.eyebrow': 'An interactive system design course',
  'home.title': 'System design you can <em>watch</em>.',
  'home.lede':
    'Every lesson is a diagram you step through. Requests flow, servers fall over, caches soak up the load — and each step explains why the next box exists.',
  'home.keys': '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>Space</kbd> pause · <kbd>R</kbd> replay · <kbd>F</kbd> fit · drag to pan',
  'home.start': 'Start',
  'home.continue': 'Continue',
  'home.review': 'Review',
  'home.soon': 'Coming soon',

  'lesson.of': 'Lesson {i} of {n}',
  'lesson.min': '{n} min',
  'lesson.steps': '{n} steps',
  'lesson.learn': 'You’ll learn',
  'lesson.timeline': 'In this lesson',
  'lesson.stepOf': 'Step {i} of {n}',
  'level.beginner': 'Beginner',
  'level.intermediate': 'Intermediate',
  'level.advanced': 'Advanced',

  'step.label': 'Step {i} / {n}',
  'step.back': 'Back',
  'step.next': 'Next',
  'step.nextTo': 'Next: {short}',
  'step.finish': 'Finish lesson',
  'step.changed': 'What changed',
  'step.keys': '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>R</kbd> replay · <kbd>Space</kbd> pause',

  'stage.replay': 'Replay',
  'stage.pause': 'Pause',
  'stage.play': 'Play',
  'stage.fit': 'Fit',
  'stage.hint': 'drag to pan · scroll or double-click to zoom',

  'chapter.setup': 'setup',
  'chapter.problem': 'problem',
  'chapter.technique': 'technique',
  'chapter.solution': 'solution',
  'chapter.tradeoff': 'trade-off',
  'chapter.insight': 'insight',
  'chapter.recap': 'recap',

  'callout.insight': 'Key idea',
  'callout.tip': 'Tip',
  'callout.warning': 'Watch out',

  'packet.req': 'request',
  'packet.res': 'response',
  'packet.slow': 'slow',
  'packet.write': 'write',
  'packet.fail': 'failure',
  'packet.poison': 'bad traffic',
  'packet.ping': 'control',
};

export type UiKey = keyof typeof en;
export default en;
