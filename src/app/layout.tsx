export const metadata = {
  title: 'Black Box Magic',
  description: 'AI-powered image analysis API for retail execution',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
