import type { Metadata, Viewport } from 'next';
import './globals.css';

import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { SAFE_FIXED_ROOT_ID } from '@/lib/safeFixedRoot';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'wrapit',
  description: 'Personal kanban to organize your tasks', // TODO: add a better description
};

// Requires the body padding in globals.css. Do not ship cover without that
// canvas: the document would paint into the notch and home indicator with
// no inset. Portaled chrome mounts in #safe-fixed-root (the safe rect).
// Overlay/scrim is the exception and expands to the physical viewport.
export const viewport: Viewport = {
  viewportFit: 'cover',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn('dark h-full antialiased', 'font-sans', geist.variable)}
    >
      <body className="flex h-full min-h-full flex-col">
        {children}
        <div id={SAFE_FIXED_ROOT_ID} className="safe-fixed-root" />
      </body>
    </html>
  );
}
