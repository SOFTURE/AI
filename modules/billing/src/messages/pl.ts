import type { en } from "./en.js";

export const pl: typeof en = {
  badge: {
    trial: "Okres próbny",
    paid: "Opłacone",
    lifetime: "Dostęp dożywotni",
    readOnly: "Tylko odczyt",
    daysLeft: { one: "został {count} dzień", few: "zostały {count} dni", many: "zostało {count} dni", other: "zostało {count} dnia" },
    until: "do {date}",
  },
  notice: {
    trialEnding: "Okres próbny kończy się {date}. Wybierz plan, żeby potem dalej wprowadzać zmiany.",
    paidEnding: "Dostęp kończy się {date}. Przedłuż go, żeby potem dalej wprowadzać zmiany.",
    trialEnded: "Okres próbny się skończył. Twoje dane są bezpieczne i nadal możesz je przeglądać; wybierz plan, żeby znów wprowadzać zmiany.",
    paidEnded: "Dostęp się skończył. Twoje dane są bezpieczne i nadal możesz je przeglądać; przedłuż go, żeby znów wprowadzać zmiany.",
    choosePlan: "Wybierz plan",
    renew: "Przedłuż dostęp",
  },
  errors: {
    billing: {
      read_only: "Konto jest w trybie tylko do odczytu. Wybierz plan, żeby wprowadzać zmiany.",
      account_unknown: "To konto już nie istnieje.",
      end_not_in_future: "Data końca musi być w przyszłości.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
    },
  },
};
