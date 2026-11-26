import type { UiMessages } from './en.ts';

const id = {
  nav: {
    course: 'Kursus',
    lessons: '{n} pelajaran',
    progress: 'Progres',
    menu: 'Menu kursus',
    hideSidebar: 'Sembunyikan sidebar kursus',
    showSidebar: 'Tampilkan sidebar kursus',
    wide: 'Lebar',
    soon: 'segera',
  },
  theme: { toggle: 'Ganti mode gelap' },
  lang: { label: 'Bahasa' },
  home: {
    eyebrow: 'Kursus system design interaktif',
    title: 'System design yang bisa kamu <em>tonton</em>.',
    lede: 'Setiap pelajaran adalah diagram yang kamu jalani langkah demi langkah. Request mengalir, server tumbang, cache menyerap beban — dan setiap langkah menjelaskan kenapa kotak berikutnya perlu ada.',
    keys: '<kbd>←</kbd> <kbd>→</kbd> langkah · <kbd>Space</kbd> jeda · <kbd>R</kbd> ulang · <kbd>F</kbd> pas-kan · seret untuk geser',
    start: 'Mulai',
    continue: 'Lanjutkan',
    review: 'Ulas lagi',
    soon: 'Segera hadir',
  },
  lesson: {
    of: 'Pelajaran {i} dari {n}',
    min: '{n} menit',
    steps: '{n} langkah',
    learn: 'Yang akan kamu pelajari',
    timeline: 'Di pelajaran ini',
    stepOf: 'Langkah {i} dari {n}',
  },
  level: { beginner: 'Pemula', intermediate: 'Menengah', advanced: 'Lanjutan' },
  step: {
    label: 'Langkah {i} / {n}',
    back: 'Kembali',
    next: 'Lanjut',
    nextTo: 'Lanjut: {short}',
    finish: 'Selesaikan pelajaran',
    changed: 'Yang berubah',
    keys: '<kbd>←</kbd> <kbd>→</kbd> langkah · <kbd>R</kbd> ulang · <kbd>Space</kbd> jeda',
  },
  stage: {
    replay: 'Ulang',
    pause: 'Jeda',
    play: 'Putar',
    fit: 'Pas',
    hint: 'seret untuk geser · scroll atau klik dua kali untuk zoom',
    beatOf: 'Momen {i} / {n}',
    prevBeat: 'Momen sebelumnya',
    nextBeat: 'Momen berikutnya',
  },
  chapter: {
    setup: 'pengantar', problem: 'masalah', technique: 'teknik', solution: 'solusi',
    tradeoff: 'trade-off', insight: 'wawasan', recap: 'rangkuman',
  },
  callout: { insight: 'Ide kunci', tip: 'Tips', warning: 'Hati-hati' },
  lab: { reset: 'Reset' },
  chaos: {
    hint: 'klik sebuah komponen untuk merusaknya',
    title: 'Rusak sistemnya',
    intro: 'Matikan sebuah komponen dan lihat apa yang gagal.',
    repair: 'Perbaiki semua',
    down: '{name} mati',
  },
  packet: {
    req: 'request', res: 'response', slow: 'lambat', write: 'tulis',
    fail: 'gagal', poison: 'trafik jahat', ping: 'kontrol',
  },
  glossary: {
    openLesson: 'Lihat: {title}',
    stageList: 'Istilah di step ini',
  },
} satisfies UiMessages;

export default id;
