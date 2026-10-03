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
    assistant: "Dostęp dla asystenta AI",
    testMail: "Wyślij wiadomość testową",
    privacy: "Twoje dane",
  },
  admin: {
    title: "Panel administratora",
    lead: "Tę stronę widzą tylko administratorzy; pozostali dostają „nie znaleziono”.",
    messageLabel: "Ogłoszenie",
    submit: "Opublikuj",
    saved: "Ogłoszenie opublikowane",
  },
  mail: {
    title: "Wiadomość testowa",
    lead: "Wysyła wiadomość na Twój adres przez @softure-ai/mailing.",
    subjectLabel: "Temat",
    defaultSubject: "Pozdrowienia z przykładu SOFTURE",
    body: "To jest wiadomość testowa z przykładowej aplikacji SOFTURE.",
    submit: "Wyślij mi wiadomość testową",
    sent: "Wiadomość testowa wysłana na Twój adres",
  },
  switches: {
    welcomeBanner: {
      label: "Baner powitalny",
      description: "Pokazuje linię powitalną na stronie głównej.",
    },
  },
  mcp: {
    whoami: "Mówi asystentowi, do którego konta należy token.",
    listEntries: "Czyta najnowsze wpisy z księgi gości.",
    signGuestbook: "Dodaje wpis do księgi gości.",
  },
  errors: {
    "guestbook.message_invalid": "Wpisz od 1 do {max} znaków.",
    "auth.forbidden": "Nie masz dostępu do tej funkcji.",
    "auth.unauthenticated": "Twoja sesja wygasła. Zaloguj się ponownie.",
    "core.database_failed": "Baza danych nie odpowiedziała. Spróbuj ponownie.",
    "mailing.invalid_input": "Tej wiadomości nie da się wysłać. Sprawdź temat i spróbuj ponownie.",
    "mailing.rejected": "Usługa pocztowa odrzuciła tę wiadomość.",
    "mailing.unavailable": "Usługa pocztowa nie odpowiada. Spróbuj ponownie za chwilę.",
    "core.unexpected": "Coś poszło nie tak. Spróbuj ponownie.",
  },
};
