import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata = {
  title: "EZA Portal",
  description: "Ethical Zekâ Arayüzü"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body
        className={`${inter.className} bg-bg text-text h-screen overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}

