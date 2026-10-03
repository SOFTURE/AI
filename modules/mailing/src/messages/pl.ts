import type { en } from "./en.js";

// Polish copy lives only in message dictionaries; the language gate exempts `messages/` folders.
export const pl: typeof en = {
  errors: {
    mailing: {
      invalid_input: "Tej wiadomości nie da się wysłać. Sprawdź adres i spróbuj ponownie.",
      rejected: "Usługa pocztowa odrzuciła tę wiadomość.",
      unavailable: "Usługa pocztowa nie odpowiada. Spróbuj ponownie za chwilę.",
      suppressed: "Ten adres wypisał się z takich wiadomości, więc nic nie wysłano.",
    },
  },
  footer: {
    text: "Nie chcesz więcej takich wiadomości? Wypisz się tutaj:",
    htmlLead: "Nie chcesz więcej takich wiadomości?",
    htmlLink: "Wypisz się",
  },
  unsubscribe: {
    title: "Wypisanie",
    lead: "Przestaniesz dostawać od nas takie wiadomości. Poczta o Twoim koncie, na przykład reset hasła, nadal będzie przychodzić.",
    submit: "Wypisz mnie",
    doneTitle: "Wypisano",
    doneBody: "Nie wyślemy Ci już takich wiadomości.",
    invalidTitle: "Ten odnośnik nie działa",
    invalidBody: "Otwórz jeszcze raz odnośnik z wiadomości, w całości. Jeśli dalej nie działa, odpisz na wiadomość i poproś o wypisanie.",
    failed: "Nie udało się tego zapisać. Spróbuj ponownie za chwilę.",
  },
};
