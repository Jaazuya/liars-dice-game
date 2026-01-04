import type { Metadata } from "next";
import { Rye } from "next/font/google";
import "./globals.css";

// Fuente principal del Oeste (Títulos y Números)
const rye = Rye({ 
  weight: "400", 
  subsets: ["latin"],
  variable: "--font-rye",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Liar's Dice - Old West",
  description: "Juego de apuestas y dados del Lejano Oeste",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${rye.variable} antialiased bg-[#1a0f0d]`}>
        {children}
      </body>
    </html>
  );
}