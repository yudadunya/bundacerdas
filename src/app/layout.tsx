import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BundaCerdas – Teman Pintar Ibu Rumah Tangga",
  description: "Bantu ibu memasak hemat, atur belanja, dan cari ide usaha dengan AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body bg-brand-50 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}
