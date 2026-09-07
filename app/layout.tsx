import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://oriental-digital-vault.caka152005.chatgpt.site'),
  title: '数字藏品系统',
  description: '兑换码驱动的轻量级游戏数字藏品系统',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: '数字藏品系统',
    description: '兑换藏品、每日签到、管理收藏，并体验安全流转。',
    type: 'website',
    locale: 'zh_CN',
    url: '/',
    images: [
      {
        url: '/og.png',
        width: 1536,
        height: 1024,
        alt: '紫金藏匣与玉璧组成的数字藏品系统视觉',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '数字藏品系统',
    description: '兑换藏品、每日签到、管理收藏，并体验安全流转。',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
