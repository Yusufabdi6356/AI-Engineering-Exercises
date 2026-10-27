import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Movies, Database and Jokes',
  description: 'AI SDK v5 chatbot with a database tool, an OMDb movie tool and a dad jokes tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
