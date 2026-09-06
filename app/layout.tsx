import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL('https://yukyo-shrine.akiopromax13.chatgpt.site'),
  title: '幽境 — 祭殿回廊',
  description: '灯籠の光をたどり、幾重にも続く祭殿の回廊へ。DualSense・タッチ・キーボードで巡る、一人称の和風空間。',
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ja" className="dark"><body>{children}</body></html>;
}
