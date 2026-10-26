import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ANAS OS",
  description: "Private personal and professional operating system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
