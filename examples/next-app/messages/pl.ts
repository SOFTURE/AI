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
    signupChannel: "Konto założone z kanału:",
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
    newsletterLabel: "Wyślij jako newsletter",
    newsletterHint: "Poczta do listy: dostaje odnośnik do wypisania i nie wychodzi, gdy się wypiszesz.",
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
  waitlist: {
    title: "Lista oczekujących",
    subtitle: "Zapisy z @softure-ai/waitlist, ze zgodami zapisanymi w privacy.consents.",
    launch: "Daj mi znać, gdy przykład wystartuje (obowiązuje polityka prywatności).",
    newsletter: "Wysyłaj mi od czasu do czasu newsletter.",
  },
  legal: {
    footer: {
      terms: "Regulamin",
      privacy: "Polityka prywatności",
      note: "Przykładowa aplikacja SOFTURE AI: demo, nie prawdziwa usługa.",
    },
    terms: {
      title: "Regulamin",
      intro: "Ten regulamin dotyczy przykładowej aplikacji SOFTURE AI, demonstracji modułów SOFTURE.",
      sections: [
        { id: "service", title: "1. Usługa", body: "Aplikacja pokazuje, jak moduły SOFTURE działają razem. Służy wyłącznie do testów." },
        { id: "account", title: "2. Twoje konto", body: "Nie udostępniaj nikomu hasła. Konto możesz usunąć w każdej chwili w zakładce Twoje dane." },
        { id: "content", title: "3. Twoje treści", body: "Wpisy w księdze gości są publiczne. Nie publikuj niczego, czego inni nie powinni czytać." },
      ],
      changes: [
        { version: "2026-10-01", date: "2026-10-01", summary: "W punkcie 2 dodano usuwanie konta." },
        { version: "2026-09-01", date: "2026-09-01", summary: "Pierwsza wersja." },
      ],
    },
    privacy: {
      title: "Polityka prywatności",
      intro: "Ta polityka mówi, co przykładowa aplikacja o Tobie przechowuje i co możesz z tym zrobić.",
      sections: [
        { id: "data", title: "1. Co przechowujemy", body: "Twój adres email, skrót hasła, Twoje sesje i Twoje zgody." },
        { id: "consents", title: "2. Twoje zgody", body: "Przy rejestracji zapisujemy, że akceptujesz te dokumenty, wraz z ich wersjami i czasem." },
        { id: "rights", title: "3. Twoje prawa", body: "Pobierz swoje dane albo usuń konto w zakładce Twoje dane. Usunięcie konta usuwa też Twoje zgody." },
      ],
      changes: [{ version: "2026-10-01", date: "2026-10-01", summary: "Pierwsza wersja." }],
    },
  },
  errors: {
    "guestbook.message_invalid": "Wpisz od 1 do {max} znaków.",
    "auth.forbidden": "Nie masz dostępu do tej funkcji.",
    "auth.unauthenticated": "Twoja sesja wygasła. Zaloguj się ponownie.",
    "core.database_failed": "Baza danych nie odpowiedziała. Spróbuj ponownie.",
    "mailing.invalid_input": "Tej wiadomości nie da się wysłać. Sprawdź temat i spróbuj ponownie.",
    "mailing.rejected": "Usługa pocztowa odrzuciła tę wiadomość.",
    "mailing.unavailable": "Usługa pocztowa nie odpowiada. Spróbuj ponownie za chwilę.",
    "mailing.suppressed": "Ten adres wypisał się z newslettera, więc nic nie wysłano.",
    "core.unexpected": "Coś poszło nie tak. Spróbuj ponownie.",
  },
};
