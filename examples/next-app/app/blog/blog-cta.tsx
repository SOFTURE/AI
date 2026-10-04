// The example's call to action on the blog: the pricing page, in the app's copy.
import { ButtonLink } from "@softure-ai/ui";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

export function BlogCta() {
  const messages = getMessages(config.locale).blog;
  return (
    <aside className="blog-example-cta" data-testid="blog-cta">
      <p>{messages.ctaLead}</p>
      <ButtonLink href="/pricing" variant="primary">
        {messages.ctaLink}
      </ButtonLink>
    </aside>
  );
}
