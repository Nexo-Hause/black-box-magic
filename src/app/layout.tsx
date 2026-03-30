import './globals.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'Black Box Magic',
  description: 'AI-powered image analysis API for retail execution',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
