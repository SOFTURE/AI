import type { en } from "./en.js";

export const pl: typeof en = {
  fields: {
    email: "E-mail",
    password: "Hasło",
    currentPassword: "Obecne hasło",
    newPassword: "Nowe hasło",
    newPasswordHint: "Co najmniej {minLength} znaków.",
    consent: "Akceptuję regulamin i politykę prywatności.",
  },
  login: {
    title: "Zaloguj się",
    lead: "Witaj ponownie.",
    submit: "Zaloguj się",
    pending: "Logowanie…",
    noAccount: "Nie masz jeszcze konta?",
    registerLink: "Załóż je",
  },
  register: {
    title: "Załóż konto",
    lead: "To zajmie chwilę.",
    submit: "Załóż konto",
    pending: "Zakładanie…",
    hasAccount: "Masz już konto?",
    loginLink: "Zaloguj się",
    closedTitle: "Rejestracja jest zamknięta",
    closedBody: "Nie można teraz założyć nowego konta. Spróbuj ponownie później.",
  },
  changePassword: {
    title: "Zmień hasło",
    lead: "Wszystkie inne urządzenia, na których jesteś zalogowany, zostaną wylogowane.",
    submit: "Zmień hasło",
    pending: "Zapisywanie…",
    success: "Hasło zostało zmienione.",
  },
  logout: {
    submit: "Wyloguj się",
  },
  errors: {
    auth: {
      invalid_credentials: "Nieprawidłowy e-mail lub hasło.",
      email_invalid: "Podaj prawidłowy adres e-mail.",
      email_taken: "Konto z tym adresem e-mail już istnieje.",
      password_too_short: "Hasło jest za krótkie.",
      password_too_long: "Hasło jest za długie.",
      consent_required: "Aby założyć konto, zaakceptuj regulamin.",
      registration_closed: "Rejestracja jest zamknięta.",
      current_password_invalid: "Obecne hasło jest nieprawidłowe.",
      unauthenticated: "Sesja wygasła. Zaloguj się ponownie.",
      forbidden: "Nie masz dostępu do tej funkcji.",
    },
    security: {
      rate_limited: "Zbyt wiele prób. Odczekaj kilka minut i spróbuj ponownie.",
      client_unidentified: "Nie udało się ustalić, skąd przyszło to żądanie. Spróbuj ponownie później.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
    },
  },
};
