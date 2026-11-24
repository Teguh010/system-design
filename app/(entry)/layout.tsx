import type { Metadata } from 'next';
import '../../src/style.css';

export const metadata: Metadata = {
  title: 'Scale Lab — system design you can watch',
  description: 'Interactive system design lessons with animated diagrams.',
  icons: { icon: '/favicon.svg' },
};

export default function EntryLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
