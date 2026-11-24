import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranslator } from 'next-intl';
import en from '../src/i18n/en.ts';
import id from '../src/i18n/id.ts';

const onError = (error: Error) => { throw error; };

test('English messages format plural counts and interpolated values', () => {
  const t = createTranslator({ locale: 'en', messages: en, onError });
  assert.equal(t('nav.lessons', { n: 1 }), '1 lesson');
  assert.equal(t('nav.lessons', { n: 2 }), '2 lessons');
  assert.equal(t('lesson.stepOf', { i: 2, n: 10 }), 'Step 2 of 10');
});

test('Indonesian messages format counts and interpolated values', () => {
  const t = createTranslator({ locale: 'id', messages: id, onError });
  assert.equal(t('nav.lessons', { n: 1 }), '1 pelajaran');
  assert.equal(t('nav.lessons', { n: 2 }), '2 pelajaran');
  assert.equal(t('lesson.stepOf', { i: 2, n: 10 }), 'Langkah 2 dari 10');
});

test('missing translations surface an error', () => {
  const t = createTranslator({ locale: 'en', messages: en, onError });
  assert.throws(() => t('nav.missing'));
});
