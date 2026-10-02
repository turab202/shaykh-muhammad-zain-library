// Root layout — minimal shell required by Next.js.
// Language, direction, and full head/body setup live in src/app/[locale]/layout.tsx.
// This root layout must render <html> and <body> to satisfy Next.js requirements,
// even though the locale layout below provides the real lang/dir/class attributes.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
