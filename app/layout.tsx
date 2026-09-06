import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://yukyo-shrine.akiopromax13.chatgpt.site'),
  title: '幽境 — 祭殿回廊',
  description: '無音の影が巡る、広大な祭殿回廊。ふすまで視界を遮り、バーストで敵を9秒間止める。DualSense・タッチ・キーボードに対応。',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ja" className="dark"><body>{children}</body></html>;
}
