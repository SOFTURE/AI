import type { en } from "./en.js";

export const pl: typeof en = {
  form: {
    email: "E-mail",
    submit: "Zapisz mnie na listę",
    pending: "Zapisywanie…",
    success: "Jesteś na liście. Dziękujemy!",
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
