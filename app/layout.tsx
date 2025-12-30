import type { Metadata } from "next";
import { Rye, DM_Serif_Display } from "next/font/google"; // Importamos fuentes
import "./globals.css";

// Fuente principal del Oeste (Títulos y Números)
const rye = Rye({ 
  weight: "400", 
  subsets: ["latin"],
  variable: "--font-rye" 
});

// Fuente secundaria más legible (Textos largos)
const dmSerif = DM_Serif_Display({ 
  weight: "400", 
  subsets: ["latin"],
  variable: "--font-dm" 
});

export const metadata: Metadata = {
  title: "Liar's Dice - Old West",
  description: "Juego de apuestas y dados",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${rye.variable} ${dmSerif.variable} antialiased bg-[#0d0d0d]`}>
        {children}
      </body>
    </html>
  );
}