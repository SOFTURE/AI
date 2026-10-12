import type { en } from "./en.js";

export const pl: typeof en = {
  errors: {
    database_failed: "Coś poszło nie tak przy zapisie lub odczycie danych. Spróbuj ponownie.",
    unexpected: "Coś poszło nie tak. Spróbuj ponownie.",
  },
  duration: {
    years: { one: "{count} rok", few: "{count} lata", many: "{count} lat", other: "{count} roku" },
    months: { one: "{count} miesiąc", few: "{count} miesiące", many: "{count} miesięcy", other: "{count} miesiąca" },
    both: "{years} i {months}",
  },
};
