import type { en } from "./en.js";

export const pl: typeof en = {
  panel: {
    title: "Przełączniki funkcji",
    lead: "Włączaj i wyłączaj funkcje dla wszystkich. Zmiana działa od następnego żądania.",
    empty: "Aplikacja nie deklaruje żadnych przełączników.",
    on: "Włączony",
    off: "Wyłączony",
    undefinedTitle: "Przełączniki czytane przez moduły, których aplikacja nie definiuje",
    undefinedItem: "{name} (moduł {module}) używa domyślnej wartości modułu. Zdefiniuj go w przełącznikach aplikacji, aby zmieniać go tutaj.",
  },
  source: {
    env: "Ustawiony zmienną środowiskową {envName}. Zmień go tam.",
    stored: "Zmieniony {date}.",
    default: "Wartość domyślna; nigdy nie zmieniany.",
    failMode: "Nie udało się odczytać zapisanej wartości, więc przełącznik pokazuje wartość bezpieczną.",
  },
  errors: {
    "feature-switches": {
      unknown_switch: "Ten przełącznik nie jest już zadeklarowany. Odśwież stronę.",
    },
    auth: {
      forbidden: "Nie masz do tego dostępu.",
    },
    core: {
      database_failed: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
      unexpected: "Coś poszło nie tak po naszej stronie. Spróbuj ponownie za chwilę.",
    },
  },
};
