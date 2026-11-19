import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hygienic Cart Loyalty Rewards — Eat 10, 11th Vada Pav FREE',
  description: 'Digital loyalty card for Hygienic Cart, Besa, Nagpur. Register once, collect 10 approved stamps, get 1 FREE Vada Pav on your 11th visit.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
