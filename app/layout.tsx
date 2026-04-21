import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hub Mathis 💎",
  description: "Investissement & Budget",
  manifest: "/manifest.json",
  themeColor: "#050505",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hub Mathis",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#050505" }}>{children}</body>
    </html>
  );
}