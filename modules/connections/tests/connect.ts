// Runs the whole connect flow against the fake provider: start, the user's consent, the callback.
import { completeAuthorization, startAuthorization } from "@softure-ai/connections/server";
import { ADMIN, type TestConnections } from "./support.js";

export async function connectFake(test: TestConnections, accountId?: string): Promise<void> {
  const started = await startAuthorization(test.ctx, { provider: test.fake.definition.id, ...(accountId === undefined ? {} : { accountId }), actorId: ADMIN });
  if (!started.ok) throw new Error(`test: start failed with ${started.error}`);
  const callback = test.fake.consent(started.value.url);
  const completed = await completeAuthorization(test.ctx, {
    params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: callback.searchParams.get("error") },
    actorId: ADMIN,
  });
  if (!completed.ok) throw new Error(`test: complete failed with ${completed.error}`);
}
