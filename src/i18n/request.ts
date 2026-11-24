import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const selected = locale ?? await requestLocale;
  if (!hasLocale(routing.locales, selected)) notFound();
  const messages = selected === 'id' ? (await import('./id')).default : (await import('./en')).default;
  return { locale: selected, messages };
});
