import type { en } from "./en.js";

export const pl: typeof en = {
  form: {
    email: "E-mail",
    submit: "Zapisz mnie na listę",
    pending: "Zapisywanie…",
    success: "Jesteś na liście. Dziękujemy!",
    confirmationSent: "Jeszcze chwila: wysłaliśmy Ci e-mail. Otwórz link z wiadomości, żeby potwierdzić adres i dołączyć do listy.",
  },
  confirmationMail: {
    subject: "Potwierdź zapis na listę oczekujących",
    text: "Cześć,\n\nktoś, mamy nadzieję, że Ty, chce zapisać ten adres na listę oczekujących. Otwórz link poniżej i potwierdź zapis. Jeśli to nie Ty, zignoruj tę wiadomość: bez potwierdzenia adres nie zostanie dodany.",
    action: "Potwierdzam zapis",
  },
  confirm: {
    title: "Potwierdź zapis",
    lead: "Potwierdź, że chcesz dołączyć do listy oczekujących z adresem, na który wysłaliśmy ten link.",
    submit: "Potwierdzam",
    doneTitle: "Jesteś na liście",
    doneBody: "Dziękujemy za potwierdzenie. Napiszemy, gdy tylko wystartujemy.",
    invalidTitle: "Ten link nie działa",
    invalidBody: "Jest niepełny albo wysłaliśmy nowszy. Użyj linku z najnowszej wiadomości albo zapisz się ponownie.",
    expiredTitle: "Ten link wygasł",
    expiredBody: "Zapisz się ponownie, a wyślemy nowy.",
    failed: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
    limited: "Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.",
  },
  welcomeMail: {
    subject: "Jesteś na liście oczekujących",
    text: "Cześć,\n\ndziękujemy za zapis na listę oczekujących. Napiszemy, gdy tylko wystartujemy.",
  },
  errors: {
    waitlist: {
      email_invalid: "Podaj poprawny adres e-mail.",
      consent_required: "Zaznacz zgodę, żeby zapisać się na listę.",
      form_invalid: "Ten formularz jest nieaktualny. Odśwież stronę i spróbuj ponownie.",
    },
    security: {
      rate_limited: "Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.",
      client_unidentified: "Nie udało się ustalić, skąd pochodzi to żądanie. Spróbuj później.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj za chwilę.",
    },
  },
};
