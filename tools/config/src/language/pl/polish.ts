// The Polish the language gate looks for. This file lives in a folder named `pl/`, so the gate
// exempts it: it has to spell the letters and words it rejects everywhere else.

export const POLISH_DIACRITIC = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

// Common Polish words that are not English words, so English prose never trips them. Polish
// written without diacritics is caught here; with diacritics, POLISH_DIACRITIC catches it first.
export const POLISH_WORDS: readonly string[] = [
  "albo", "bedzie", "bez", "blad", "czy", "czyli", "dla", "dlaczego", "dodaj", "dziala", "gdy",
  "gdzie", "haslo", "jako", "jesli", "jeszcze", "jest", "juz", "kiedy", "ktora", "ktore", "ktory",
  "mozna", "moze", "nalezy", "nie", "nigdy", "oraz", "plik", "pliku", "poniewaz", "potem", "przez",
  "sie", "sobie", "sprawdz", "tego", "teraz", "trzeba", "tutaj", "tylko", "usun", "uzytkownik",
  "wiec", "wszystko", "zawsze", "zeby", "zmiana", "zmianka", "zrobic",
];
