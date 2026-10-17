import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import localFont from 'next/font/local';
import type { Metadata } from 'next';
import { ToastProvider } from '@/components/toast-provider';

// 自托管 Inter：next/font/google 在构建/dev 时需要访问 fonts.gstatic.com，
// 该域名在部分网络环境下不可达，会让 Turbopack 直接报
// "Can't resolve '@vercel/turbopack-next/internal/font/google/font'"。
// 字体文件取自 @fontsource-variable/inter@5.2.8 的 latin 可变字重子集。
const inter = localFont({
  src: './fonts/inter-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
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
