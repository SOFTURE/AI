import type { en } from "./en.js";

export const pl: typeof en = {
  page: {
    title: "Twoje dane",
    lead: "Pobierz kopię danych, które ta aplikacja o Tobie przechowuje, albo usuń konto.",
  },
  export: {
    title: "Pobierz swoje dane",
    description: "Plik JSON ze wszystkim, co ta aplikacja przechowuje o Twoim koncie.",
    button: "Pobierz moje dane",
  },
  delete: {
    title: "Usuń konto",
    description: "To usunie Twoje konto i dane oraz wyloguje Cię na wszystkich urządzeniach. Tego nie da się cofnąć.",
    password: "Obecne hasło",
    confirm: "Rozumiem, że moje konto i moje dane zostaną usunięte na zawsze.",
    submit: "Usuń moje konto",
    pending: "Usuwanie…",
  },
  errors: {
    privacy: {
      export_failed: "Nie udało się zebrać Twoich danych. Spróbuj ponownie za chwilę.",
      export_too_large: "Twoich danych jest za dużo, by pobrać je tutaj. Napisz do nas, a prześlemy je.",
      deletion_refused: "Nie można teraz usunąć konta, bo część jego danych musimy jeszcze przechowywać. Napisz do nas po szczegóły.",
      password_invalid: "To nie jest Twoje obecne hasło.",
      confirmation_required: "Potwierdź, że chcesz usunąć konto.",
    },
    auth: {
      unauthenticated: "Twoja sesja wygasła. Zaloguj się ponownie.",
    },
    security: {
      rate_limited: "Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
    },
  },
};
