import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ScaleLab from '../../../../../components/ScaleLab';
import { allLessons, findInCourse } from '../../../../../src/course';
import { localize } from '../../../../../src/lessons/localize';

type Params = { lang: string; id: string; step: string };

export function generateStaticParams() {
  return allLessons.flatMap(({ id, lesson }) =>
    lesson ? lesson.steps.map((_, index) => ({ id, step: String(index + 1) })) : [],
  );
}

async function getPage(params: Promise<Params>) {
  const { lang, id, step } = await params;
  if (lang !== 'en' && lang !== 'id') notFound();
  const source = findInCourse(id)?.entry.lesson;
  const index = Number(step) - 1;
  if (!source || !/^[1-9]\d*$/.test(step) || !Number.isSafeInteger(index) || index >= source.steps.length) notFound();
  return { lang: lang as 'en' | 'id', id, step: index + 1, lesson: await localize(source, lang) };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id, step, lesson } = await getPage(params);
  return {
    title: `${lesson.steps[step - 1]!.title} · ${lesson.title} · Scale Lab`,
    description: lesson.summary,
    alternates: { languages: {
      en: `/en/lessons/${id}/${step}/`,
      id: `/id/lessons/${id}/${step}/`,
    } },
  };
}

export default async function LessonPage({ params }: { params: Promise<Params> }) {
  const { lang, id, step, lesson } = await getPage(params);
  return <ScaleLab locale={lang} lessonId={id} step={step} lesson={lesson} />;
}
