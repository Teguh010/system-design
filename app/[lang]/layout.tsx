import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../src/i18n/routing';
import '../../src/style.css';

export const metadata: Metadata = {
  title: 'Scale Lab — system design you can watch',
  description: 'Interactive system design lessons with animated diagrams.',
  icons: { icon: '/favicon.svg' },
};

export function generateStaticParams() {
  return routing.locales.map((lang) => ({ lang }));
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
  if (!hasLocale(routing.locales, lang)) notFound();
  setRequestLocale(lang);
  const messages = await getMessages({ locale: lang });
  return <html lang={lang} suppressHydrationWarning><head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head><body><NextIntlClientProvider locale={lang} messages={messages}>{children}</NextIntlClientProvider></body></html>;
}
