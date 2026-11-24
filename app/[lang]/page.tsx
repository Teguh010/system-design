import { notFound } from 'next/navigation';
import ScaleLab from '../../components/ScaleLab';

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (lang !== 'en' && lang !== 'id') notFound();
  return <ScaleLab locale={lang} />;
}
