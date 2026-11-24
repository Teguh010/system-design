import type { UiKey } from './en.ts';

const id: Record<UiKey, string> = {
  'nav.course': 'Kursus',
  'nav.lessons': '{n} pelajaran',
  'nav.progress': 'Progres',
  'nav.menu': 'Menu kursus',
  'nav.soon': 'segera',
  'theme.toggle': 'Ganti mode gelap',
  'lang.label': 'Bahasa',

  'home.eyebrow': 'Kursus system design interaktif',
  'home.title': 'System design yang bisa kamu <em>tonton</em>.',
  'home.lede':
    'Setiap pelajaran adalah diagram yang kamu jalani langkah demi langkah. Request mengalir, server tumbang, cache menyerap beban — dan setiap langkah menjelaskan kenapa kotak berikutnya perlu ada.',
  'home.keys': '<kbd>←</kbd> <kbd>→</kbd> langkah · <kbd>Space</kbd> jeda · <kbd>R</kbd> ulang · <kbd>F</kbd> pas-kan · seret untuk geser',
  'home.start': 'Mulai',
  'home.continue': 'Lanjutkan',
  'home.review': 'Ulas lagi',
  'home.soon': 'Segera hadir',

  'lesson.of': 'Pelajaran {i} dari {n}',
  'lesson.min': '{n} menit',
  'lesson.steps': '{n} langkah',
  'lesson.learn': 'Yang akan kamu pelajari',
  'lesson.timeline': 'Di pelajaran ini',
  'lesson.stepOf': 'Langkah {i} dari {n}',
  'level.beginner': 'Pemula',
  'level.intermediate': 'Menengah',
  'level.advanced': 'Lanjutan',

  'step.label': 'Langkah {i} / {n}',
  'step.back': 'Kembali',
  'step.next': 'Lanjut',
  'step.nextTo': 'Lanjut: {short}',
  'step.finish': 'Selesaikan pelajaran',
  'step.changed': 'Yang berubah',
  'step.keys': '<kbd>←</kbd> <kbd>→</kbd> langkah · <kbd>R</kbd> ulang · <kbd>Space</kbd> jeda',

  'stage.replay': 'Ulang',
  'stage.pause': 'Jeda',
  'stage.play': 'Putar',
  'stage.fit': 'Pas',
  'stage.hint': 'seret untuk geser · scroll atau klik dua kali untuk zoom',

  'chapter.setup': 'pengantar',
  'chapter.problem': 'masalah',
  'chapter.technique': 'teknik',
  'chapter.solution': 'solusi',
  'chapter.tradeoff': 'trade-off',
  'chapter.insight': 'wawasan',
  'chapter.recap': 'rangkuman',

  'callout.insight': 'Ide kunci',
  'callout.tip': 'Tips',
  'callout.warning': 'Hati-hati',

  'packet.req': 'request',
  'packet.res': 'response',
  'packet.slow': 'lambat',
  'packet.write': 'tulis',
  'packet.fail': 'gagal',
  'packet.poison': 'trafik jahat',
  'packet.ping': 'kontrol',
};

export default id;
