import { getPrivacyMessages } from "@softure-ai/privacy/next";
import { LegalFooter } from "@softure-ai/privacy/ui";
import { SoftureThemeProvider, ThemeScript, ToastHost } from "@softure-ai/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getMessages } from "../messages/index.ts";
import config from "../softure.config.ts";
import "./globals.css";

const messages = getMessages(config.locale);

export const metadata: Metadata = {
  title: messages.meta.title,
  description: messages.meta.description,
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang={config.locale} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <SoftureThemeProvider>
          {children}
          <LegalFooter
            links={[
              { href: "/legal/terms", label: messages.legal.footer.terms },
              { href: "/legal/privacy", label: messages.legal.footer.privacy },
            ]}
            note={messages.legal.footer.note}
            messages={getPrivacyMessages(config)}
          />
          <ToastHost />
        </SoftureThemeProvider>
      </body>
    </html>
  );
}
