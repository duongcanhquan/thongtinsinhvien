import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tra cứu dữ liệu | Cao Đẳng Việt Mỹ - Hà Nội",
  description:
    "Hệ thống tra cứu dữ liệu sinh viên Cao Đẳng Việt Mỹ - Hà Nội",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
