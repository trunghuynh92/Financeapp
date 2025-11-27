import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { HelpProvider } from "@/contexts/HelpContext";
import { HelpPanel } from "@/components/help/help-panel";
import { Toaster } from "@/components/ui/toaster";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

export const metadata: Metadata = {
  title: "Finance Management SaaS",
  description: "Manage your finances with ease",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <HelpProvider>
            <AuthProvider>{children}</AuthProvider>
            <HelpPanel />
            <Toaster />
          </HelpProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
