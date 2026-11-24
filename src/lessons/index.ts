import type { Lesson } from '../types.ts';
import { urlShortener } from './url-shortener.ts';

export const lessons: Lesson[] = [urlShortener];

export const findLesson = (id: string) => lessons.find((l) => l.id === id);
