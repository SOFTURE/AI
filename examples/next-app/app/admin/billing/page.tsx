// A page shipped by the billing package, mounted with one line: the admin grants a plan once its
// invoice is paid. Anyone without the admin role, signed in or not, gets not found.
export { BillingAdminPage as default } from "@softure-ai/billing/next";

export const dynamic = "force-dynamic";
