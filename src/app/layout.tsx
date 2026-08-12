import type { Metadata } from 'next';
import './globals.css';

import AuthNav from '@/components/auth/AuthNav';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'wrapit',
  description: 'Personal kanban to organize your tasks', // TODO: add a better description
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn('dark h-full antialiased', 'font-sans', geist.variable)}>
      <body className="min-h-full flex flex-col">
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
