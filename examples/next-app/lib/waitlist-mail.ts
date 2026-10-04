// The app's layout for the waitlist's HTML mails (`waitlist({ mailTemplate })`): a small document
// with the app's name as a header around the module's default body. e2e/waitlist.spec.ts checks
// that both mails carry it.
import { escapeHtml, type WaitlistMailTemplate } from "@softure-ai/waitlist";
import { en } from "../messages/en.ts";
import { pl } from "../messages/pl.ts";

const APP_NAMES = { en: en.meta.title, pl: pl.meta.title };

export const waitlistMailLayout: WaitlistMailTemplate = (mail) =>
  [
    "<!doctype html>",
    `<html lang="${mail.locale}">`,
    `<head><meta charset="utf-8"><title>${escapeHtml(mail.subject)}</title></head>`,
    "<body>",
    `<h1 data-app-mail="${mail.kind}">${escapeHtml(APP_NAMES[mail.locale])}</h1>`,
    mail.body,
    "</body>",
    "</html>",
  ].join("\n");
