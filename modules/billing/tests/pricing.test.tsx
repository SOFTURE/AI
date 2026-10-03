// @vitest-environment happy-dom
// The pricing tiles, the payment form and the admin grant form render from props: prices and
// periods in the locale, the featured and the chosen plan, the links, the invoice fields of a
// manual payment and the checkout button of a hosted one, an error and a success.
import { billingMessages, INITIAL_PAYMENT_FORM_STATE, type GrantFormState, type PaymentFormState, type Plan } from "@softure-ai/billing";
import { GrantForm, PaymentForm, PricingTiles } from "@softure-ai/billing/ui";
import type { LinkComponentProps } from "@softure-ai/ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = billingMessages.en;
const pl = billingMessages.pl;

const MONTHLY: Plan = {
  id: "monthly",
  name: { en: "Monthly", pl: "Monthly (pl)" },
  description: { en: "Pay as you go." },
  price: { amount: 2900, currency: "PLN" },
  period: { unit: "month", count: 1 },
  features: [{ en: "Unlimited notes", pl: "Unlimited notes (pl)" }, { en: "Export" }],
  isFeatured: false,
};
const QUARTERLY: Plan = { ...MONTHLY, id: "quarterly", name: { en: "Quarterly" }, period: { unit: "month", count: 3 }, isFeatured: true, features: [] };
const LIFETIME: Plan = { ...MONTHLY, id: "lifetime", name: { en: "Lifetime" }, price: { amount: 49900, currency: "PLN" }, period: { unit: "lifetime" }, features: [] };
const PLANS = [MONTHLY, QUARTERLY, LIFETIME];

function plain(text: string | null | undefined): string {
  return (text ?? "").replace(/[\u00a0\u202f]/g, " ");
}

function tile(planId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-plan="${planId}"]`);
  if (element === null) throw new Error(`no tile for ${planId}`);
  return element;
}

describe("PricingTiles", () => {
  it("shows each plan's name, price, period, description and features", () => {
    render(<PricingTiles plans={PLANS} messages={en} locale="en" label={en.payment.plansLabel} />);
    expect(screen.getByRole("list", { name: en.payment.plansLabel })).toBeDefined();
    expect(plain(tile("monthly").textContent)).toBe("MonthlyPLN 29.00per monthPay as you go.Unlimited notesExport");
    expect(plain(tile("quarterly").textContent)).toBe("RecommendedQuarterlyPLN 29.00per 3 monthsPay as you go.");
    expect(plain(tile("lifetime").textContent)).toBe("LifetimePLN 499.00one-time paymentPay as you go.");
    expect(tile("quarterly").getAttribute("data-featured")).toBe("true");
    // No href builder: nothing to click.
    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("speaks the app's locale: Polish texts, prices and plurals, English where a text has no Polish", () => {
    render(<PricingTiles plans={[MONTHLY, { ...QUARTERLY, period: { unit: "month", count: 5 } }]} messages={pl} locale="pl" />);
    expect(plain(tile("monthly").textContent)).toBe(`Monthly (pl)29,00 z\u0142${pl.pricing.period.month.one}Pay as you go.Unlimited notes (pl)Export`);
    expect(within(tile("quarterly")).getByText(pl.pricing.period.month.many.replace("{count}", "5"))).toBeDefined();
  });

  it("links every plan but the chosen one, through the app's link component", () => {
    function AppLink(props: LinkComponentProps) {
      return <a {...props} data-app-link="" />;
    }
    render(<PricingTiles plans={PLANS} messages={en} locale="en" getPlanHref={(plan) => `/payment?plan=${plan.id}`} selectedPlanId="quarterly" LinkComponent={AppLink} />);
    const link = screen.getByRole("link", { name: "Choose Monthly" });
    expect(link.getAttribute("href")).toBe("/payment?plan=monthly");
    expect(link.hasAttribute("data-app-link")).toBe(true);
    expect(screen.queryByRole("link", { name: "Choose Quarterly" })).toBeNull();
    expect(tile("quarterly").getAttribute("aria-current")).toBe("true");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("says so when there are no plans", () => {
    render(<PricingTiles plans={[]} messages={en} locale="en" />);
    expect(screen.getByText(en.pricing.empty)).toBeDefined();
  });

  it("takes slot classes, or only them when unstyled", () => {
    render(<PricingTiles plans={[QUARTERLY]} messages={en} locale="en" classNames={{ root: "app-tiles", tile: "app-tile" }} unstyled />);
    expect(screen.getByRole("list").className).toBe("app-tiles");
    expect(tile("quarterly").className).toBe("app-tile");
  });
});

describe("PaymentForm", () => {
  it("asks for the invoice details of a manual payment and sends the plan with them", async () => {
    const sent: FormData[] = [];
    const action = (_previous: PaymentFormState, formData: FormData): Promise<PaymentFormState> => {
      sent.push(formData);
      return Promise.resolve({ status: "requested" });
    };
    render(<PaymentForm action={action} planId="monthly" planName="Monthly" email="ada@example.com" collectsInvoiceDetails messages={en} locale="en" />);
    fireEvent.change(screen.getByLabelText(en.payment.fields.name), { target: { value: "Ada Ltd" } });
    fireEvent.change(screen.getByLabelText(en.payment.fields.taxId), { target: { value: "PL123" } });
    fireEvent.change(screen.getByLabelText(en.payment.fields.address), { target: { value: "1 Way" } });
    fireEvent.click(screen.getByRole("button", { name: en.payment.requestInvoice }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(
      "Thank you! Your invoice request for Monthly has been sent. We will email the invoice to ada@example.com; your access starts once it is paid.",
    ));
    expect(Object.fromEntries(sent[0]?.entries() ?? [])).toEqual({ plan: "monthly", invoiceName: "Ada Ltd", invoiceTaxId: "PL123", invoiceAddress: "1 Way" });
  });

  it("is one checkout button for a provider that collects its own details", () => {
    render(<PaymentForm action={() => Promise.resolve(INITIAL_PAYMENT_FORM_STATE)} planId="monthly" planName="Monthly" email="ada@example.com" collectsInvoiceDetails={false} messages={en} />);
    expect(screen.getByRole("button", { name: en.payment.checkout })).toBeDefined();
    expect(screen.queryAllByRole("textbox")).toEqual([]);
  });

  it("shows field errors at their fields, keeps what was typed, and a form error on its own", async () => {
    let answer: PaymentFormState = {
      status: "error",
      error: "billing.invoice_details_invalid",
      fieldErrors: { invoiceAddress: "billing.invoice_details_invalid" },
      values: { invoiceName: "Ada Ltd", invoiceTaxId: "", invoiceAddress: "" },
    };
    render(<PaymentForm action={() => Promise.resolve(answer)} planId="monthly" planName="Monthly" email="ada@example.com" collectsInvoiceDetails messages={en} />);
    // The browser checks required fields first; the server's answer is what this test is about.
    fireEvent.change(screen.getByLabelText(en.payment.fields.name), { target: { value: "Ada Ltd" } });
    fireEvent.change(screen.getByLabelText(en.payment.fields.address), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: en.payment.requestInvoice }));
    await waitFor(() => expect(screen.getByText(en.errors.billing.invoice_details_invalid)).toBeDefined());
    expect(screen.getByLabelText(en.payment.fields.address).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText<HTMLInputElement>(en.payment.fields.name).value).toBe("Ada Ltd");
    expect(screen.queryByRole("alert")).toBeNull();

    answer = { status: "error", error: "security.rate_limited", values: { invoiceName: "Ada Ltd", invoiceTaxId: "", invoiceAddress: "x" } };
    fireEvent.change(screen.getByLabelText(en.payment.fields.address), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: en.payment.requestInvoice }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.errors.security.rate_limited));
  });
});

describe("GrantForm", () => {
  const OPTIONS = [
    { value: "monthly", label: "Monthly" },
    { value: "lifetime", label: "Lifetime" },
  ];

  it("sends the email and the plan, then says what the account has now", async () => {
    const sent: FormData[] = [];
    const action = (_previous: GrantFormState, formData: FormData): Promise<GrantFormState> => {
      sent.push(formData);
      return Promise.resolve({ status: "granted", notice: "ada@example.com now has Monthly.", planId: "monthly" });
    };
    render(<GrantForm action={action} plans={OPTIONS} messages={en} locale="en" />);
    fireEvent.change(screen.getByLabelText(en.admin.email), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: en.admin.submit }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("ada@example.com now has Monthly."));
    expect(Object.fromEntries(sent[0]?.entries() ?? [])).toEqual({ email: "ada@example.com", plan: "monthly" });
    expect(screen.getByLabelText<HTMLInputElement>(en.admin.email).value).toBe("");
  });

  it("shows an unknown account at the email field and other errors on the form", async () => {
    let answer: GrantFormState = { status: "error", error: "billing.account_unknown", email: "nobody@example.com", planId: "lifetime" };
    render(<GrantForm action={() => Promise.resolve(answer)} plans={OPTIONS} messages={en} />);
    fireEvent.change(screen.getByLabelText(en.admin.email), { target: { value: "nobody@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: en.admin.submit }));
    await waitFor(() => expect(screen.getByLabelText(en.admin.email).getAttribute("aria-invalid")).toBe("true"));
    expect(screen.getByLabelText<HTMLInputElement>(en.admin.email).value).toBe("nobody@example.com");
    expect(screen.queryByRole("alert")).toBeNull();

    answer = { status: "error", error: "auth.forbidden" };
    fireEvent.click(screen.getByRole("button", { name: en.admin.submit }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.errors.auth.forbidden));
  });
});
