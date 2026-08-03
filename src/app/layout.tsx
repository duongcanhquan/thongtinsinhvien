import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thông tin sinh viên",
  description: "Tra cứu và rà soát hồ sơ sinh viên",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
