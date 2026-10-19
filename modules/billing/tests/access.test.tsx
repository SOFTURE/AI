// @vitest-environment happy-dom
// The badge and the notice render from an entitlement: what each status reads, the last day of
// access in the app's time zone, the locale's plural rules, the payment link and the slots.
import { billingMessages, type BillingMessages, type Entitlement } from "@softure-ai/billing";
import { AccessBadge, AccessNotice, getAccessBadgeKind } from "@softure-ai/billing/ui";
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

function renderBadge(entitlement: Entitlement, locale = "en", messages: BillingMessages = en) {
  return render(<AccessBadge entitlement={entitlement} messages={messages} locale={locale} timezone={TIMEZONE} />);
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
  ] as const)("picks the plural form of the locale for %i days", (daysLeft, form) => {
    const daysLeftForms = { one: "{count} [one]", few: "{count} [few]", many: "{count} [many]", other: "{count} [other]" };
    renderBadge({ ...TRIAL, daysLeft }, "pl", { ...en, badge: { ...en.badge, daysLeft: daysLeftForms } });
    expect(screen.getByText(`${daysLeft} [${form}]`)).toBeDefined();
  });

  it("takes slot classes, or only them when unstyled", () => {
    const { container } = render(
      <AccessBadge entitlement={TRIAL} messages={en} locale="en" timezone={TIMEZONE} classNames={{ root: "app-badge", status: "app-status" }} unstyled />,
    );
    expect(container.firstElementChild?.className).toBe("app-badge");
    expect(screen.getByText(en.badge.trial).className).toBe("app-status");
  });
});

describe("AccessBadge options", () => {
  /** A trial of about seven years, as an app gives an invited account. */
  const LONG_TRIAL: Entitlement = { status: "trial", endsAt: new Date("2033-10-16T22:00:00Z"), daysLeft: 2557, isEnding: false };
  const LONG_PAID: Entitlement = { status: "paid", endsAt: new Date("2033-11-30T23:00:00Z"), daysLeft: 2602, isEnding: false };

  function renderWith(entitlement: Entitlement, extra: Partial<Parameters<typeof AccessBadge>[0]>) {
    return render(<AccessBadge entitlement={entitlement} messages={en} locale="en" timezone={TIMEZONE} {...extra} />);
  }

  it("reads access with more days left than unlimitedAfterDays as unlimited, in the success tone", () => {
    for (const entitlement of [LONG_TRIAL, LONG_PAID]) {
      const root = renderWith(entitlement, { unlimitedAfterDays: 1826 }).container.firstElementChild;
      expect(root?.textContent).toBe("Unlimited access");
      expect(root?.getAttribute("data-unlimited")).toBe("true");
      expect(screen.getByText("Unlimited access").className).toContain("sft:text-success");
      cleanup();
    }
  });

  it("keeps the days left at or under unlimitedAfterDays, and without the option", () => {
    expect(renderWith({ ...LONG_TRIAL, daysLeft: 1826 }, { unlimitedAfterDays: 1826 }).container.firstElementChild?.textContent).toBe("Trial1826 days left");
    cleanup();
    const root = renderWith(LONG_TRIAL, {}).container.firstElementChild;
    expect(root?.textContent).toBe("Trial2557 days left");
    expect(root?.hasAttribute("data-unlimited")).toBe(false);
  });

  it("writes a compact detail: a bare day count for a trial, the numeric last day for paid access", () => {
    expect(renderWith(TRIAL, { compact: true }).container.firstElementChild?.textContent).toBe("Trial14 days");
    cleanup();
    expect(renderWith(PAID, { compact: true }).container.firstElementChild?.textContent).toBe("Paiduntil 11/30/2026");
    cleanup();
    expect(renderWith(LIFETIME, { compact: true }).container.firstElementChild?.textContent).toBe("Lifetime access");
  });

  it("takes the app's tone per kind and keeps the default tone of the others", () => {
    renderWith(TRIAL, { tones: { trial: "success", "read-only": "warning" } });
    expect(screen.getByText(en.badge.trial).className).toContain("sft:text-success");
    cleanup();
    renderWith(TRIAL_ENDED, { tones: { trial: "success" } });
    expect(screen.getByText(en.badge.readOnly).className).toContain("sft:text-danger");
  });

  it.each([
    [TRIAL, "trial"],
    [TRIAL_ENDING, "trial-ending"],
    [PAID, "paid"],
    [PAID_ENDING, "paid-ending"],
    [LIFETIME, "lifetime"],
    [TRIAL_ENDED, "read-only"],
    [LONG_TRIAL, "unlimited"],
  ] as const)("names the kind of %o as %s", (entitlement, kind) => {
    expect(getAccessBadgeKind(entitlement, { unlimitedAfterDays: 1826 })).toBe(kind);
  });
});

describe("AccessBadge texts, short form, prefix and tone (#426)", () => {
  function renderWith(entitlement: Entitlement, extra: Partial<Parameters<typeof AccessBadge>[0]>) {
    return render(<AccessBadge entitlement={entitlement} messages={en} locale="en" timezone={TIMEZONE} {...extra} />);
  }

  it("keeps the default markup when no new option is set", () => {
    const root = renderBadge(TRIAL).container.firstElementChild;
    expect(root?.children).toHaveLength(2);
    expect(root?.getAttribute("data-kind")).toBe("trial");
    expect(root?.getAttribute("data-tone")).toBe("neutral");
  });

  it("replaces the text of the kinds the app words itself, with the days left, and keeps the others", () => {
    const texts = {
      trial: ({ daysLeft }: { readonly daysLeft: number | null }) => ({ status: `Trial · ${String(daysLeft)} days` }),
      "paid-ending": ({ daysLeft }: { readonly daysLeft: number | null }) => ({ status: "Paid", detail: `${String(daysLeft)} days` }),
      lifetime: () => ({ status: "No limit" }),
    };
    expect(renderWith(TRIAL, { texts }).container.firstElementChild?.textContent).toBe("Trial · 14 days");
    cleanup();
    expect(renderWith(PAID_ENDING, { texts }).container.firstElementChild?.textContent).toBe("Paid7 days");
    cleanup();
    expect(renderWith(LIFETIME, { texts }).container.firstElementChild?.textContent).toBe("No limit");
    cleanup();
    expect(renderWith(PAID, { texts }).container.firstElementChild?.textContent).toBe("Paiduntil November 30, 2026");
  });

  it("hands the formatter the kind, the entitlement, the end and the default text", () => {
    const seen: unknown[] = [];
    renderWith(PAID, {
      texts: {
        paid: (input) => {
          seen.push(input);
          return input.text;
        },
      },
    });
    expect(seen).toEqual([{ kind: "paid", entitlement: PAID, daysLeft: 59, endsAt: PAID_END, text: { status: "Paid", detail: "until November 30, 2026" } }]);
  });

  it("renders the short text alone, or the status when the kind has none", () => {
    const texts = { trial: () => ({ status: "Trial", detail: "14 days left", short: "14 d" }) };
    const root = renderWith(TRIAL, { texts, variant: "short" }).container.firstElementChild;
    expect(root?.textContent).toBe("14 d");
    expect(root?.children).toHaveLength(1);
    cleanup();
    expect(renderWith(PAID, { variant: "short" }).container.firstElementChild?.textContent).toBe("Paid");
  });

  it("swaps the full and the short text at the md breakpoint when responsive", () => {
    const texts = { trial: () => ({ status: "Trial", detail: "14 days left", short: "14 d" }) };
    renderWith(TRIAL, { texts, variant: "responsive" });
    const full = screen.getByText("Trial").parentElement;
    expect(full?.className).toContain("sft:hidden");
    expect(full?.className).toContain("sft:md:flex");
    expect(full?.textContent).toBe("Trial14 days left");
    expect(screen.getByText("14 d").className).toContain("sft:md:hidden");
  });

  it("reads an accessible prefix first, hidden from sight", () => {
    const root = renderWith(TRIAL, { srPrefix: "Access status:" }).container.firstElementChild;
    expect(root?.textContent).toBe("Access status: Trial14 days left");
    expect(root?.firstElementChild?.className).toBe("sft:sr-only");
  });

  it.each([
    [TRIAL, "trial", "neutral"],
    [TRIAL_ENDING, "trial-ending", "warning"],
    [PAID, "paid", "success"],
    [PAID_ENDING, "paid-ending", "warning"],
    [LIFETIME, "lifetime", "success"],
    [PAID_ENDED, "read-only", "danger"],
  ] as const)("sets data-kind and data-tone on the root of %o", (entitlement, kind, tone) => {
    const root = renderBadge(entitlement).container.firstElementChild;
    expect(root?.getAttribute("data-kind")).toBe(kind);
    expect(root?.getAttribute("data-tone")).toBe(tone);
  });

  it("puts the app's tone in data-tone", () => {
    expect(renderWith(TRIAL, { tones: { trial: "success" } }).container.firstElementChild?.getAttribute("data-tone")).toBe("success");
  });

  it("colours all the pill's text with toneScope pill, and only the status by default", () => {
    const pill = renderWith(PAID_ENDING, { toneScope: "pill" }).container.firstElementChild;
    expect(pill?.className).toContain("sft:text-warning");
    expect(screen.getByText(en.badge.paid).className).toBe("sft:font-medium");
    expect(screen.getByText("until November 30, 2026").className).toBe("");
    cleanup();
    renderWith(PAID_ENDING, {});
    expect(screen.getByText(en.badge.paid).className).toContain("sft:text-warning");
    expect(screen.getByText("until November 30, 2026").className).toBe("sft:text-muted");
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

  it("frames an ending and an ended notice in the app's tones", () => {
    renderNotice(TRIAL_ENDING, { tones: { ending: "danger" } });
    expect(screen.getByRole("status").className).toContain("sft:border-danger/50");
    cleanup();
    renderNotice(TRIAL_ENDED, { tones: { ending: "neutral" } });
    expect(screen.getByRole("status").className).toContain("sft:border-danger/50");
    cleanup();
    renderNotice(TRIAL_ENDED, { tones: { ended: "neutral" } });
    expect(screen.getByRole("status").className).toContain("sft:border-border-strong");
  });

  it("renders the app's own actions after the payment link", () => {
    renderNotice(TRIAL_ENDED, { extraActions: <a href="/account/export">Download your data</a> });
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/payment", "/account/export"]);
    expect(links[1]?.parentElement?.className).toBe("sft:flex sft:shrink-0 sft:flex-wrap sft:items-center sft:gap-3");
    cleanup();
    renderNotice(PAID_ENDING, { extraActions: <a href="/account/export">Download your data</a> });
    expect(screen.getByRole("link", { name: "Download your data" }).getAttribute("href")).toBe("/account/export");
  });

  it("hides the app's own actions with the notice outside its reminder window", () => {
    expect(renderNotice(TRIAL, { extraActions: <a href="/account/export">Download your data</a> }).container.innerHTML).toBe("");
  });

  it("renders the link through the app's link component", () => {
    function AppLink(props: LinkComponentProps) {
      return <a {...props} data-app-link="" />;
    }
    renderNotice(TRIAL_ENDED, { LinkComponent: AppLink });
    expect(screen.getByRole("link", { name: en.notice.choosePlan }).hasAttribute("data-app-link")).toBe(true);
  });
});
