import type { AppMessages } from "./en.ts";

export const pl: AppMessages = {
  meta: {
    title: "SOFTURE AI: przykład",
    description: "Aplikacja Next.js zbudowana z @softure-ai/core, db i ui.",
  },
  home: {
    title: "Przykładowa aplikacja SOFTURE AI",
    lead: "Core, db i ui zainstalowane jako spakowane paczki, tak jak aplikacja dostaje je z npm.",
    welcomeBanner: "Witaj! Ten baner jest widoczny, bo administrator włączył jego przełącznik.",
  },
  guestbook: {
    title: "Księga gości",
    subtitle: "Wpisy leżą w schemacie guestbook, który tworzy jego migracja.",
    add: "Dodaj wpis",
    modalTitle: "Nowy wpis",
    messageLabel: "Wiadomość",
    submit: "Zapisz wpis",
    saved: "Wpis zapisany",
    empty: "Nie ma jeszcze wpisów",
    emptyBody: "Dodaj pierwszy.",
  },
  migrations: {
    title: "Zastosowane migracje",
    subtitle: "Wiersze rejestru softure.migrations.",
    empty: "Brak migracji. Uruchom npm run migrate.",
  },
  account: {
    title: "Twoje konto",
    lead: "Tę stronę widzą tylko zalogowani użytkownicy.",
    changePassword: "Zmień hasło",
    admin: "Panel administratora",
  },
  admin: {
    title: "Panel administratora",
    lead: "Tę stronę widzą tylko administratorzy; pozostali dostają „nie znaleziono”.",
    messageLabel: "Ogłoszenie",
    submit: "Opublikuj",
    saved: "Ogłoszenie opublikowane",
  },
  switches: {
    welcomeBanner: {
      label: "Baner powitalny",
      description: "Pokazuje linię powitalną na stronie głównej.",
    },
  },
  errors: {
    "guestbook.message_invalid": "Wpisz od 1 do {max} znaków.",
    "auth.forbidden": "Nie masz dostępu do tej funkcji.",
    "core.database_failed": "Baza danych nie odpowiedziała. Spróbuj ponownie.",
    "core.unexpected": "Coś poszło nie tak. Spróbuj ponownie.",
  },
};
