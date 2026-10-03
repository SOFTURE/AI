// @vitest-environment happy-dom
// The badge and the notice render from an entitlement: what each status reads, the last day of
// access in the app's time zone, Polish plurals, the payment link and the slots.
import { billingMessages, type Entitlement } from "@softure-ai/billing";
import { AccessBadge, AccessNotice } from "@softure-ai/billing/ui";
import type { LinkComponentProps } from "@softure-ai/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = billingMessages.en;
const TIMEZONE = "Europe/Warsaw";
/** Midnight starting 17 October in Warsaw: the last day of access is 16 October. */
const TRIAL_END = new Date("2026-10-16T22:00:00Z");
const PAID_END = new Date("2026-11-30T23:00:00Z");

const TRIAL: Entitlement = { status: "trial", endsAt: TRIAL_END, daysLeft: 14, isEnding: false };
const TRIAL_ENDING: Entitlement = { status: "trial", endsAt: TRIAL_END, daysLeft: 1, isEnding: true };
const PAID: Entitlement = { status: "paid", endsAt: PAID_END, daysLeft: 59, isEnding: false };
const PAID_ENDING: Entitlement = { status: "paid", endsAt: PAID_END, daysLeft: 7, isEnding: true };
const LIFETIME: Entitlement = { status: "paid", endsAt: null, daysLeft: null, isEnding: false };
const TRIAL_ENDED: Entitlement = { status: "read_only", since: TRIAL_END, reason: "trial_ended" };
const PAID_ENDED: Entitlement = { status: "read_only", since: PAID_END, reason: "paid_ended" };

function renderBadge(entitlement: Entitlement, locale: "en" | "pl" = "en") {
  return render(<AccessBadge entitlement={entitlement} messages={billingMessages[locale]} locale={locale} timezone={TIMEZONE} />);
}

function renderNotice(entitlement: Entitlement, extra: Partial<Parameters<typeof AccessNotice>[0]> = {}) {
  return render(<AccessNotice entitlement={entitlement} messages={en} locale="en" timezone={TIMEZONE} paymentHref="/payment" {...extra} />);
}

describe("AccessBadge", () => {
  it.each([
    ["a trial", TRIAL, "Trial14 days left", "trial"],
    ["the last trial day", TRIAL_ENDING, "Trial1 day left", "trial"],
    ["paid access, its last day in Warsaw", PAID, "Paiduntil November 30, 2026", "paid"],
    ["lifetime access", LIFETIME, "Lifetime access", "paid"],
    ["a read-only account", TRIAL_ENDED, "Read-only", "read_only"],
  ] as const)("reads %s", (_case, entitlement, text, status) => {
    const { container } = renderBadge(entitlement);
    const root = container.firstElementChild;
    expect(root?.textContent).toBe(text);
    expect(root?.getAttribute("data-status")).toBe(status);
  });

  it("flags access in its reminder window", () => {
    expect(renderBadge(PAID_ENDING).container.firstElementChild?.getAttribute("data-ending")).toBe("true");
    cleanup();
    expect(renderBadge(PAID).container.firstElementChild?.hasAttribute("data-ending")).toBe(false);
  });

  it.each([
    [1, "one"],
    [3, "few"],
    [5, "many"],
    [22, "few"],
  ] as const)("picks the Polish plural form for %i days", (daysLeft, form) => {
    renderBadge({ ...TRIAL, daysLeft }, "pl");
    expect(screen.getByText(billingMessages.pl.badge.daysLeft[form].replace("{count}", String(daysLeft)))).toBeDefined();
  });

  it("takes slot classes, or only them when unstyled", () => {
    const { container } = render(
      <AccessBadge entitlement={TRIAL} messages={en} locale="en" timezone={TIMEZONE} classNames={{ root: "app-badge", status: "app-status" }} unstyled />,
    );
    expect(container.firstElementChild?.className).toBe("app-badge");
    expect(screen.getByText(en.badge.trial).className).toBe("app-status");
  });
});

describe("AccessNotice", () => {
  it("renders nothing while access is outside its reminder window", () => {
    for (const entitlement of [TRIAL, PAID, LIFETIME]) {
      expect(renderNotice(entitlement).container.innerHTML).toBe("");
      cleanup();
    }
  });

  it.each([
    ["an ending trial", TRIAL_ENDING, "Your trial ends on October 16, 2026. Choose a plan to keep writing after that.", en.notice.choosePlan],
    ["ending paid access", PAID_ENDING, "Your access ends on November 30, 2026. Renew it to keep writing after that.", en.notice.renew],
    ["an ended trial", TRIAL_ENDED, en.notice.trialEnded, en.notice.choosePlan],
    ["ended paid access", PAID_ENDED, en.notice.paidEnded, en.notice.renew],
  ] as const)("tells about %s and links to the payment page", (_case, entitlement, text, action) => {
    renderNotice(entitlement);
    expect(screen.getByRole("status").textContent).toBe(`${text}${action}`);
    expect(screen.getByRole("link", { name: action }).getAttribute("href")).toBe("/payment");
  });

  it("renders the link through the app's link component", () => {
    function AppLink(props: LinkComponentProps) {
      return <a {...props} data-app-link="" />;
    }
    renderNotice(TRIAL_ENDED, { LinkComponent: AppLink });
    expect(screen.getByRole("link", { name: en.notice.choosePlan }).hasAttribute("data-app-link")).toBe(true);
  });
});
