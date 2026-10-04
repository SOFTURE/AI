// The invoice fields' schema: trimmed values, a code per problem and field, control characters
// refused in every field, and the database refusing them too.
import { parseInvoiceDetails } from "@softure-ai/billing/server";
import { ok } from "@softure-ai/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAccount, createTestBilling, type TestBilling } from "./support.js";

const VALID = { name: "Ada Lovelace Ltd", taxId: "PL1234567890", address: "1 Analytical Way, London" };

describe("parseInvoiceDetails", () => {
  it("trims every field and turns an empty tax id into null", () => {
    expect(parseInvoiceDetails({ name: "  Ada Lovelace Ltd ", taxId: "   ", address: " 1 Analytical Way, London  " })).toEqual(
      ok({ name: "Ada Lovelace Ltd", taxId: null, address: "1 Analytical Way, London" }),
    );
  });

  it("says which required field is empty", () => {
    expect(parseInvoiceDetails({ name: " ", taxId: "", address: "" })).toEqual({
      ok: false,
      error: "billing.invoice_details_invalid",
      fieldErrors: { invoiceName: "billing.invoice_field_required", invoiceAddress: "billing.invoice_field_required" },
    });
  });

  it("accepts each field at its limit and says too long one character over it", () => {
    const atLimit = { name: "n".repeat(200), taxId: "t".repeat(32), address: "a".repeat(500) };
    expect(parseInvoiceDetails(atLimit).ok).toBe(true);
    expect(parseInvoiceDetails({ name: `${atLimit.name}n`, taxId: `${atLimit.taxId}t`, address: `${atLimit.address}a` })).toEqual({
      ok: false,
      error: "billing.invoice_details_invalid",
      fieldErrors: {
        invoiceName: "billing.invoice_field_too_long",
        invoiceTaxId: "billing.invoice_field_too_long",
        invoiceAddress: "billing.invoice_field_too_long",
      },
    });
  });

  it.each([
    ["a line break", "Ada\nPlan: Lifetime"],
    ["a carriage return", "Ada\rLtd"],
    ["a tab", "Ada\tLtd"],
    ["an escape", "Ada\u001b[31mLtd"],
    ["DEL", "Ada\u007fLtd"],
    ["a C1 control", "Ada\u0085Ltd"],
  ])("refuses %s inside any field", (_label, value) => {
    expect(parseInvoiceDetails({ name: value, taxId: value, address: value })).toEqual({
      ok: false,
      error: "billing.invoice_details_invalid",
      fieldErrors: {
        invoiceName: "billing.invoice_field_control_characters",
        invoiceTaxId: "billing.invoice_field_control_characters",
        invoiceAddress: "billing.invoice_field_control_characters",
      },
    });
  });

  it("reports one problem per field: control characters before length", () => {
    expect(parseInvoiceDetails({ ...VALID, name: `${"n".repeat(300)}\n${"n".repeat(10)}` })).toMatchObject({
      fieldErrors: { invoiceName: "billing.invoice_field_control_characters" },
    });
  });

  it("keeps letters, spaces and punctuation of any script", () => {
    expect(parseInvoiceDetails({ name: "M\u00fcller & S\u00f6hne GmbH \u2014 \u6771\u4eac", taxId: "DE 123-456-789", address: "Stra\u00dfe 1/2, 8001 Z\u00fcrich" }).ok).toBe(true);
  });
});

describe("the payment_requests table", () => {
  let test: TestBilling;
  let adaId: string;

  beforeEach(async () => {
    test = await createTestBilling();
    adaId = await createAccount(test, "ada@example.com");
  });
  afterEach(() => test.database.close());

  const insert = (name: string, taxId: string | null, address: string) =>
    test.database.client.query(
      "INSERT INTO billing.payment_requests (user_id, plan_id, invoice_name, invoice_tax_id, invoice_address, status, requested_at) VALUES ($1, 'monthly', $2, $3, $4, 'open', now())",
      [adaId, name, taxId, address],
    );

  it.each([
    ["invoice_name", ["Ada\nLtd", null, "1 Analytical Way"]],
    ["invoice_tax_id", ["Ada", "PL\t1", "1 Analytical Way"]],
    ["invoice_address", ["Ada", null, "1 Analytical Way\u0085London"]],
  ] as const)("refuses a control character in %s written directly", async (column, [name, taxId, address]) => {
    await expect(insert(name, taxId, address)).rejects.toThrow(`payment_requests_${column}_printable`);
  });

  it("stores printable details", async () => {
    await insert("M\u00fcller & S\u00f6hne GmbH", "DE123456789", "Stra\u00dfe 1, Z\u00fcrich");
  });
});
