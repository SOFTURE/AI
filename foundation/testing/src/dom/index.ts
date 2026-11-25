// DOM test helpers for `*.dom.test.*` files (`softureVitestConfig({ dom: true })`).
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { userEvent, type Options as UserEventOptions, type UserEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";

export interface RenderWithUserOptions {
  /** Passed to Testing Library's `render`. */
  render?: RenderOptions;
  /** Passed to `userEvent.setup`, e.g. `{ advanceTimers: vi.advanceTimersByTime }` with fake timers. */
  user?: UserEventOptions;
}

/** Renders `ui` and returns Testing Library's result with a `user` that types, clicks and presses keys like a person. */
export function renderWithUser(ui: ReactElement, options: RenderWithUserOptions = {}): RenderResult & { user: UserEvent } {
  const user = userEvent.setup(options.user);
  return { user, ...render(ui, options.render) };
}
