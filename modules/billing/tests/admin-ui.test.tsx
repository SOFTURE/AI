// @vitest-environment happy-dom
// The admin page's lists render from rows prepared on the server: each open request with its
// Grant, Dismiss and history link, each history entry with its state and a Revoke button only on an
// active manual grant, and the empty states. Buttons submit their row's id to their action and show
// its error under the row.
import { billingMessages, type AdminActionState, type TrialFormState } from "@softure-ai/billing";
import { GrantHistory, PaymentRequestList, TrialForm, type GrantHistoryRow, type PaymentRequestRow } from "@softure-ai/billing/ui";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = billingMessages.en;

const REQUEST: PaymentRequestRow = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "ada@example.com · Monthly",
  details: ["Requested on October 3, 2026", "Invoice to: Ada Lovelace Ltd, 1 Analytical Way"],
  historyHref: "/admin/billing?account=22222222-2222-4222-8222-222222222222",
  grantLabel: "Grant Monthly to ada@example.com",
  dismissLabel: "Dismiss the request of ada@example.com for Monthly",
};

const ACTIVE: GrantHistoryRow = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Monthly, granted from a request",
  statusText: "Active",
  isCurrent: true,
  details: ["Granted on October 3, 2026", "Access from October 17, 2026 to November 16, 2026"],
  revokeLabel: "Revoke Monthly granted on October 3, 2026",
};

const PAID: GrantHistoryRow = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Monthly, paid with stripe",
  statusText: "Refunded on October 5, 2026",
  isCurrent: false,
  details: ["Paid PLN 29.00 on October 4, 2026"],
  revokeLabel: null,
};

/** An action that records the id it was sent and answers `answer`. */
function createAction(field: string, answer: AdminActionState) {
  const sent: string[] = [];
  const action = (_previous: AdminActionState, formData: FormData): Promise<AdminActionState> => {
    const value = formData.get(field);
    sent.push(typeof value === "string" ? value : "");
    return Promise.resolve(answer);
  };
  return { sent, action };
}

describe("PaymentRequestList", () => {
  it("lists each request with its details, buttons named after it and a link to its account", () => {
    const noop = createAction("request", { status: "done" });
    render(<PaymentRequestList requests={[REQUEST]} grantAction={noop.action} dismissAction={noop.action} messages={en} />);
    const list = screen.getByRole("list", { name: en.admin.requests.title });
    expect(list.textContent).toContain("ada@example.com · MonthlyRequested on October 3, 2026Invoice to: Ada Lovelace Ltd, 1 Analytical Way");
    expect(screen.getByRole("button", { name: REQUEST.grantLabel }).textContent).toBe(en.admin.requests.grant);
    expect(screen.getByRole("button", { name: REQUEST.dismissLabel }).textContent).toBe(en.admin.requests.dismiss);
    expect(screen.getByRole("link", { name: en.admin.requests.history }).getAttribute("href")).toBe(REQUEST.historyHref);
  });

  it("sends the request's id to the grant action and shows its error under the row", async () => {
    const grant = createAction("request", { status: "error", error: "billing.lifetime_active" });
    const dismiss = createAction("request", { status: "done" });
    render(<PaymentRequestList requests={[REQUEST]} grantAction={grant.action} dismissAction={dismiss.action} messages={en} />);
    fireEvent.click(screen.getByRole("button", { name: REQUEST.grantLabel }));
    await waitFor(() => expect(screen.getByText(en.errors.billing.lifetime_active)).toBeTruthy());
    expect(grant.sent).toEqual([REQUEST.id]);
    expect(dismiss.sent).toEqual([]);
  });

  it("says when there is no open request", () => {
    const noop = createAction("request", { status: "done" });
    render(<PaymentRequestList requests={[]} grantAction={noop.action} dismissAction={noop.action} messages={en} />);
    expect(screen.getByText(en.admin.requests.empty)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("GrantHistory", () => {
  it("shows each entry's state and offers Revoke only on an active manual grant", () => {
    const revoke = createAction("grant", { status: "done" });
    render(<GrantHistory rows={[ACTIVE, PAID]} revokeAction={revoke.action} messages={billingMessages.en} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Monthly, granted from a requestRevokeActiveGranted on October 3, 2026Access from October 17, 2026 to November 16, 2026",
      "Monthly, paid with stripeRefunded on October 5, 2026Paid PLN 29.00 on October 4, 2026",
    ]);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("sends the grant's id to the revoke action and shows its error", async () => {
    const revoke = createAction("grant", { status: "error", error: "billing.grant_revoked" });
    render(<GrantHistory rows={[ACTIVE]} revokeAction={revoke.action} messages={en} />);
    fireEvent.click(screen.getByRole("button", { name: ACTIVE.revokeLabel ?? "" }));
    await waitFor(() => expect(screen.getByText(en.errors.billing.grant_revoked)).toBeTruthy());
    expect(revoke.sent).toEqual([ACTIVE.id]);
  });

  it("says when the account has no grants or payments", () => {
    const revoke = createAction("grant", { status: "done" });
    render(<GrantHistory rows={[]} revokeAction={revoke.action} messages={billingMessages.pl} />);
    expect(screen.getByText(billingMessages.pl.admin.history.empty)).toBeTruthy();
  });
});

describe("TrialForm", () => {
  /** An action that records the fields it was sent and answers `answer`. */
  function createTrialAction(answer: TrialFormState) {
    const sent: Record<string, FormDataEntryValue | null>[] = [];
    const action = (_previous: TrialFormState, formData: FormData): Promise<TrialFormState> => {
      sent.push({ email: formData.get("email"), trialLastDay: formData.get("trialLastDay") });
      return Promise.resolve(answer);
    };
    return { sent, action };
  }

  it("sends the email and the last day, then says until when the trial lasts", async () => {
    const { sent, action } = createTrialAction({ status: "extended", notice: "ada@example.com now has a trial until October 31, 2026." });
    render(<TrialForm action={action} messages={en} />);
    fireEvent.change(screen.getByLabelText(en.admin.trial.email), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText(en.admin.trial.lastDay), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: en.admin.trial.submit }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe("ada@example.com now has a trial until October 31, 2026.");
    });
    expect(sent).toEqual([{ email: "ada@example.com", trialLastDay: "2026-10-31" }]);
    expect(screen.getByLabelText<HTMLInputElement>(en.admin.trial.lastDay).type).toBe("date");
  });

  it("shows a day error at the day field and keeps what was typed", async () => {
    const { action } = createTrialAction({ status: "error", error: "billing.trial_not_extended", email: "ada@example.com", lastDay: "2026-10-10" });
    render(<TrialForm action={action} messages={en} />);
    fireEvent.change(screen.getByLabelText(en.admin.trial.email), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText(en.admin.trial.lastDay), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByRole("button", { name: en.admin.trial.submit }));
    await waitFor(() => {
      expect(document.body.textContent).toContain(en.errors.billing.trial_not_extended);
    });
    await waitFor(() => {
      expect(screen.getByLabelText<HTMLInputElement>(en.admin.trial.lastDay).value).toBe("2026-10-10");
    });
    expect(screen.getByLabelText<HTMLInputElement>(en.admin.trial.email).value).toBe("ada@example.com");
    expect(document.body.textContent).toContain(en.errors.billing.trial_not_extended);
  });
});
