import { HomeHero, QRCodePlayground } from '@/components/qrcode-playground';

export default function HomePage() {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <HomeHero />
      <QRCodePlayground />
    </main>
  );
}
