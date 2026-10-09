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
  confirmAction: {
    failed: "Brak połączenia z serwerem. Spróbuj ponownie.",
  },
  copyButton: {
    copy: "Kopiuj",
    copied: "Skopiowano",
    failed: "Nie udało się skopiować",
    manualLabel: "Tekst do skopiowania",
    manualHint: "Naciśnij Ctrl+C (Cmd+C na Macu), aby skopiować.",
  },
  externalLink: {
    newTab: "(otwiera się w nowej karcie)",
  },
  errors: {
    amount_invalid: "Wpisz kwotę z maksymalnie dwoma miejscami po przecinku, na przykład {example}.",
    amount_out_of_range: "Ta kwota jest za duża.",
  },
};
