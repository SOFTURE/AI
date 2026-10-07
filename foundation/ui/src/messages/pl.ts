import type { en } from "./en.js";

export const pl: typeof en = {
  themeSwitch: {
    legend: "Motyw",
    light: "Jasny",
    dark: "Ciemny",
    system: "Systemowy",
  },
  card: {
    hintLabel: "Co to jest: {title}",
    expand: "Rozwiń: {title}",
    collapse: "Zwiń: {title}",
  },
  field: {
    hintLabel: "Podpowiedź: {label}",
  },
  modal: {
    close: "Zamknij",
    cancel: "Anuluj",
  },
  actionForm: {
    pending: "Zapisywanie…",
    failed: "Brak połączenia z serwerem. Spróbuj ponownie.",
  },
  errors: {
    amount_invalid: "Wpisz kwotę z maksymalnie dwoma miejscami po przecinku, na przykład {example}.",
    amount_out_of_range: "Ta kwota jest za duża.",
  },
};
