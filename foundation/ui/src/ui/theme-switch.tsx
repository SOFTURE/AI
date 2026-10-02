"use client";

import { type DeepPartial, type Locale, mergeMessages } from "@softure-ai/core";
import { useId, useState, useSyncExternalStore } from "react";
import { type UiMessages, uiMessages } from "../messages/index.js";
import { applyThemeChoice, parseThemeCookie, THEME_CHOICES, type ThemeChoice } from "../theme/theme-cookie.js";
import { getThemeColors } from "../theme/theme-css.js";
import type { SoftureTheme } from "../theme/tokens.js";
import { type ClassNames, getSlotClass } from "./class-names.js";

export type ThemeSwitchSlot = "root" | "legend" | "options" | "option" | "input" | "label";

export interface ThemeSwitchProps {
  readonly locale?: Locale;
  /** Partial copy overrides for the current locale. */
  readonly messages?: DeepPartial<UiMessages["themeSwitch"]>;
  readonly classNames?: ClassNames<ThemeSwitchSlot>;
  /** Render structure and behaviour only; the app styles every slot. */
  readonly unstyled?: boolean;
  readonly cookieName?: string;
  /** Cookie `Domain`, to share the choice across subdomains. */
  readonly cookieDomain?: string;
  /** The theme in use, for the browser bar colour. */
  readonly theme?: SoftureTheme;
  readonly onChange?: (choice: ThemeChoice) => void;
}

const DEFAULT_CLASSES: Readonly<Record<ThemeSwitchSlot, string>> = {
  root: "sft:m-0 sft:min-w-0 sft:border-0 sft:p-0 sft:font-sans sft:text-foreground",
  legend: "sft:mb-2 sft:p-0 sft:text-sm sft:font-semibold",
  options:
    "sft:inline-flex sft:gap-1 sft:rounded-control sft:border sft:border-border sft:bg-surface sft:p-1",
  option:
    "sft:relative sft:cursor-pointer sft:rounded-control sft:px-3 sft:py-1 sft:text-sm sft:text-muted sft:transition-colors sft:duration-(--sft-duration-fast) sft:ease-(--sft-ease-out) sft:hover:text-foreground sft:has-checked:bg-accent-fill sft:has-checked:text-on-accent sft:has-focus-visible:outline-2 sft:has-focus-visible:outline-offset-2 sft:has-focus-visible:outline-focus",
  input: "sft:sr-only",
  label: "sft:font-medium",
};

function subscribeNever(): () => void {
  return () => undefined;
}

function getServerChoice(): ThemeChoice {
  return "system";
}

/**
 * Light · Dark · System, a native radio group (arrow keys move the choice). The choice applies at
 * once, without a reload, and survives reloads through the cookie read by `ThemeScript`. The server
 * renders "System"; the browser reads the cookie after hydration. The page theme itself does not
 * wait for hydration: the boot script has set it already.
 */
export function ThemeSwitch({
  locale = "en",
  messages,
  classNames,
  unstyled,
  cookieName,
  cookieDomain,
  theme,
  onChange,
}: ThemeSwitchProps) {
  const name = useId();
  const cookieChoice = useSyncExternalStore(
    subscribeNever,
    () => parseThemeCookie(document.cookie, cookieName),
    getServerChoice,
  );
  const [picked, setPicked] = useState<ThemeChoice | null>(null);
  const choice = picked ?? cookieChoice;
  const copy = mergeMessages(uiMessages, { [locale]: { themeSwitch: messages } })[locale].themeSwitch;
  const slot = (part: ThemeSwitchSlot) => getSlotClass({ slot: part, defaults: DEFAULT_CLASSES, classNames, unstyled });

  function handleChange(next: ThemeChoice) {
    applyThemeChoice(next, { cookieName, domain: cookieDomain, themeColors: getThemeColors(theme) });
    setPicked(next);
    onChange?.(next);
  }

  return (
    <fieldset className={slot("root")}>
      <legend className={slot("legend")}>{copy.legend}</legend>
      <div className={slot("options")}>
        {THEME_CHOICES.map((option) => (
          <label key={option} className={slot("option")}>
            <input
              type="radio"
              className={slot("input")}
              name={name}
              value={option}
              checked={choice === option}
              onChange={() => handleChange(option)}
            />
            <span className={slot("label")}>{copy[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
