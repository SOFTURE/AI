import type { en } from "./en.js";

// Polish copy lives only in message dictionaries; the language gate exempts `messages/` folders.
export const pl: typeof en = {
  errors: {
    mailing: {
      invalid_input: "Tej wiadomości nie da się wysłać. Sprawdź adres i spróbuj ponownie.",
      rejected: "Usługa pocztowa odrzuciła tę wiadomość.",
      unavailable: "Usługa pocztowa nie odpowiada. Spróbuj ponownie za chwilę.",
    },
  },
};
