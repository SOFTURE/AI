// A public pricing page of the app's own: its copy around the billing package's tiles, whose
// buttons open the payment page with the plan (it asks a visitor to log in first).
import { Pricing } from "@softure-ai/billing/next";
import { Card } from "@softure-ai/ui";
import Link from "next/link";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

export default function PricingPage() {
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.pricing.title} subtitle={messages.pricing.lead}>
        <Pricing LinkComponent={Link} />
      </Card>
    </main>
  );
}
