import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";

export const metadata: Metadata = {
  title: "SumFlow - Hệ thống Quản lý Bán hàng & Hóa đơn",
  description: "SumFlow — phần mềm quản lý bán hàng, lập báo giá, hóa đơn, chứng từ thu chi, kho hàng và theo dõi công nợ chuyên nghiệp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
