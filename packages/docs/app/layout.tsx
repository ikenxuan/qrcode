import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/toast-provider';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://github.com/ikenxuan/qrcode'),
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="zh-CN" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
        <RootProvider>
          {children}
          <ToastProvider />
        </RootProvider>
      </body>
    </html>
  );
}
