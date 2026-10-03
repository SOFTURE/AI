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
  pricing: {
    period: {
      day: { one: "za dzień", few: "za {count} dni", many: "za {count} dni", other: "za {count} dnia" },
      week: { one: "za tydzień", few: "za {count} tygodnie", many: "za {count} tygodni", other: "za {count} tygodnia" },
      month: { one: "za miesiąc", few: "za {count} miesiące", many: "za {count} miesięcy", other: "za {count} miesiąca" },
      year: { one: "za rok", few: "za {count} lata", many: "za {count} lat", other: "za {count} roku" },
      lifetime: "płatność jednorazowa",
    },
    featured: "Polecany",
    choose: "Wybierz {plan}",
    empty: "Nie ma jeszcze dostępnych planów.",
  },
  payment: {
    title: "Wybierz plan",
    lead: "Wybierz plan dla siebie. Płatny dostęp zaczyna się, gdy skończy się obecny.",
    plansLabel: "Plany",
    orderTitle: "Twoje zamówienie",
    orderLead: "{plan}, {price} {period}",
    changePlan: "Wybierz inny plan",
    invoiceLead: "Fakturę wyślemy na adres {email}. Dostęp zacznie się po jej opłaceniu.",
    fields: {
      name: "Imię i nazwisko lub firma",
      taxId: "NIP (opcjonalnie)",
      address: "Adres do faktury",
    },
    requestInvoice: "Poproś o fakturę",
    checkout: "Przejdź do płatności",
    pending: "Wysyłanie…",
    requested: "Dziękujemy! Prośba o fakturę za {plan} została wysłana. Fakturę wyślemy na adres {email}; dostęp zacznie się po jej opłaceniu.",
    checkoutSuccess: "Dziękujemy za płatność! Dostęp zaktualizujemy, gdy płatność zostanie potwierdzona, zwykle w ciągu minuty.",
    checkoutCancelled: "Płatność została anulowana i nic nie pobrano. Możesz spróbować ponownie albo wybrać inny plan.",
  },
  admin: {
    title: "Nadaj dostęp",
    lead: "Nadaj plan kontu, gdy wpłynie płatność. Płatny okres zaczyna się, gdy skończy się obecny dostęp konta.",
    email: "E-mail konta",
    plan: "Plan",
    submit: "Nadaj plan",
    pending: "Nadawanie…",
    granted: "{email} ma teraz {plan}.",
    grantedUntil: "{email} ma teraz {plan}, z dostępem do {date}.",
    noPlans: "Nie ma planów do nadania: dodaj je w billing({ plans }).",
  },
  errors: {
    billing: {
      read_only: "Konto jest w trybie tylko do odczytu. Wybierz plan, żeby wprowadzać zmiany.",
      account_unknown: "Żadne konto nie ma tego adresu e-mail.",
      end_not_in_future: "Data końca musi być w przyszłości.",
      plan_unknown: "Ten plan nie jest już dostępny. Wybierz inny.",
      invoice_details_invalid: "Wypełnij to pole (nie może być zbyt długie).",
      payment_failed: "Nie udało się rozpocząć płatności. Spróbuj za chwilę.",
    },
    security: {
      rate_limited: "Zbyt wiele prób. Spróbuj później.",
    },
    auth: {
      forbidden: "Nie masz uprawnień do tej operacji.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
    },
  },
};
