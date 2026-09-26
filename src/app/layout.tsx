import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Museum of Almost — Futures that nearly happened",
  description:
    "Six fictional inventions. Many possible futures. An interactive exhibition about the things we almost made.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
