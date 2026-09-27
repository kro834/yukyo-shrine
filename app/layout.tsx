import type { Metadata, Viewport } from 'next';
import './globals.css';
import {assetPath} from './asset-path';
export const metadata: Metadata = {
  metadataBase: new URL('https://kro834.github.io/yukyo-shrine/'),
  title: '幽境 — 祭殿回廊',
  manifest: assetPath('/manifest.webmanifest'),
  icons: {
    icon: assetPath('/favicon.svg'),
    apple: [{url:assetPath('/icons/yukyo-apple-v62.png'),sizes:'180x180',type:'image/png'}],
  },
  appleWebApp: {capable:true,title:'幽境',statusBarStyle:'black-translucent'},
  other: {'apple-mobile-web-app-capable':'yes'},
  description: '無音の影が巡る、広大な祭殿回廊。ふすまで視界を遮り、バーストで敵を9秒間止める。DualSense・タッチ・キーボードに対応。',
};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#100f10'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ja" className="dark"><body>{children}</body></html>;
}
