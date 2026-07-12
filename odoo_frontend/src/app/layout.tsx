import type { Metadata } from "next";
import "./globals.css";
import { AppContextProvider } from "@/context/AppContext";
import { LayoutWrapper } from "@/components/LayoutWrapper";

export const metadata: Metadata = {
  title: "AssetFlow — Enterprise Asset & Resource Management",
  description: "Enterprise Asset & Resource Management System for Hackathon Build",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppContextProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AppContextProvider>
      </body>
    </html>
  );
}
