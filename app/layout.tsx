import type { Metadata } from 'next';
import './globals.css';

import AuthNav from '@/app/components/AuthNav';

export const metadata: Metadata = {
  title: 'wrapit',
  description: 'Personal kanban to organize your tasks', // TODO: add a better description
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthNav />
        {children}
      </body>
    </html>
  );
}
