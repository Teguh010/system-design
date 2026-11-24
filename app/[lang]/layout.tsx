import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import '../../src/style.css';

export const metadata: Metadata = {
  title: 'Scale Lab — system design you can watch',
  description: 'Interactive system design lessons with animated diagrams.',
  icons: { icon: '/favicon.svg' },
};

export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'id' }];
}

const themeScript = `try {
  var saved = JSON.parse(localStorage.getItem('stl:theme'));
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.dataset.theme = 'dark';
} catch (e) {}`;

export default async function LocaleLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (lang !== 'en' && lang !== 'id') notFound();
  return <html lang={lang} suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head><body>{children}</body></html>;
}
