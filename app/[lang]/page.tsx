import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import ScaleLab from '../../components/ScaleLab';
import { routing } from '../../src/i18n/routing';

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) notFound();
  return <ScaleLab locale={lang} />;
}
