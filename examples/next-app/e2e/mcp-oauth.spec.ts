// OAuth 2.1 of @softure-ai/mcp-access on the built app, as an assistant such as claude.ai runs it:
// the endpoint's 401 names the resource metadata, discovery leads to the authorization server, the
// client registers itself, the signed-in person allows it on the consent page, the code becomes
// tokens, the tools answer, the refresh token rotates (and a replayed one revokes the grant), and
// disconnecting the app on the token page stops its access at once.
import { createHash, randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { formatMessage } from "@softure-ai/core";
import { mcpAccessMessages } from "@softure-ai/mcp-access";
import { openPageAsNewClient, randomClientAddress, uniqueEmail } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const mcpCopy = mcpAccessMessages.en;
const PASSWORD = "correct horse battery";
const REDIRECT_URI = "https://assistant.example/oauth/callback";
const createdEmails: string[] = [];

interface TokenAnswer {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly token_type: string;
  readonly scope: string;
}

test.afterAll(async () => {
  const database = await openTestDatabase();
  try {
    // Grants, codes and tokens go with their accounts (ON DELETE CASCADE).
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

async function postForm(request: APIRequestContext, path: string, form: Record<string, string>) {
  return request.post(path, { headers: { "cf-connecting-ip": randomClientAddress() }, form });
}

async function listTools(request: APIRequestContext, accessToken: string): Promise<{ status: number; names?: string[] }> {
  const response = await request.post("/api/mcp", {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "cf-connecting-ip": randomClientAddress(),
      authorization: `Bearer ${accessToken}`,
    },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  if (response.status() !== 200) return { status: response.status() };
  const body = await response.text();
  const data = body.startsWith("event:") ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) : body;
  const parsed = JSON.parse(data ?? "{}") as { result?: { tools?: { name: string }[] } };
  return { status: 200, names: parsed.result?.tools?.map((tool) => tool.name) };
}

/**
 * Allows the client on the consent page, ticking "also allow changes" when it is offered for a
 * write request, and returns where the decision sent the browser: the `Location` of the decision
 * route's 303. The client's own host does not exist, so its page is answered by the test.
 */
async function allowOnConsentPage(page: Page, authorizeUrl: string, options: { readonly clientName: string; readonly isWriteRequested: boolean }): Promise<URL> {
  await page.route(`${REDIRECT_URI}**`, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "back at the assistant" }));
  await page.goto(authorizeUrl);
  await expect(page.getByText(formatMessage(mcpCopy.consent.title, { client: options.clientName }))).toBeVisible();
  const writeBox = page.getByRole("checkbox", { name: mcpCopy.consent.allowWrite });
  if (options.isWriteRequested) await writeBox.check();
  else await expect(writeBox).toHaveCount(0);
  const decision = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/oauth/authorize");
  await page.getByRole("button", { name: mcpCopy.consent.allow }).click();
  const answer = await decision;
  expect(answer.status()).toBe(303);
  return new URL(answer.headers().location ?? "", answer.url());
}

test("an assistant connects through OAuth, refreshes its tokens and loses access when disconnected", async ({ browser, request, baseURL }) => {
  const origin = baseURL ?? "";
  const challenge = await request.post("/api/mcp", {
    headers: { "content-type": "application/json", "cf-connecting-ip": randomClientAddress() },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(challenge.status()).toBe(401);
  const resourceMetadataUrl = /resource_metadata="([^"]+)"/.exec(challenge.headers()["www-authenticate"] ?? "")?.[1];
  expect(resourceMetadataUrl).toBe(`${origin}/.well-known/oauth-protected-resource/api/mcp`);

  const resource = (await (await request.get(resourceMetadataUrl ?? "")).json()) as { resource: string; authorization_servers: string[] };
  expect(resource.resource).toBe(`${origin}/api/mcp`);
  const metadata = (await (await request.get("/.well-known/oauth-authorization-server")).json()) as {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint: string;
    code_challenge_methods_supported: string[];
  };
  expect(metadata).toMatchObject({ issuer: resource.authorization_servers[0], code_challenge_methods_supported: ["S256"] });

  const clientName = `E2E assistant ${randomBytes(4).toString("hex")}`;
  const registered = await request.post(metadata.registration_endpoint, {
    headers: { "cf-connecting-ip": randomClientAddress() },
    data: { client_name: clientName, redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" },
  });
  expect(registered.status()).toBe(201);
  const { client_id: clientId } = (await registered.json()) as { client_id: string };

  const page = await openPageAsNewClient(browser);
  const email = uniqueEmail("e2e-oauth");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });
  const pkce = createPkce();
  const authorizeUrl = new URL(metadata.authorization_endpoint);
  for (const [name, value] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state: "e2e-state",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    scope: "mcp:read mcp:write",
    resource: resource.resource,
  })) {
    authorizeUrl.searchParams.set(name, value);
  }
  const redirect = await allowOnConsentPage(page, authorizeUrl.toString(), { clientName, isWriteRequested: true });
  expect(redirect.searchParams.get("state")).toBe("e2e-state");
  expect(redirect.searchParams.get("iss")).toBe(metadata.issuer);
  const code = redirect.searchParams.get("code") ?? "";

  const exchanged = await postForm(request, metadata.token_endpoint, {
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: pkce.verifier,
    resource: resource.resource,
  });
  expect(exchanged.status()).toBe(200);
  const first = (await exchanged.json()) as TokenAnswer;
  expect(first).toMatchObject({ token_type: "Bearer", scope: "mcp:read mcp:write" });
  expect((await listTools(request, first.access_token)).names).toContain("sign_guestbook");

  const refreshed = await postForm(request, metadata.token_endpoint, { grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: clientId });
  expect(refreshed.status()).toBe(200);
  const second = (await refreshed.json()) as TokenAnswer;
  expect(second.refresh_token).not.toBe(first.refresh_token);
  expect((await listTools(request, second.access_token)).status).toBe(200);

  await page.goto("/account/mcp");
  const item = page.getByRole("listitem").filter({ hasText: clientName });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: `${mcpCopy.grants.disconnect}: ${clientName}` }).click();
  await expect(page.getByText(mcpCopy.grants.empty)).toBeVisible();
  expect((await listTools(request, second.access_token)).status).toBe(401);
  const afterDisconnect = await postForm(request, metadata.token_endpoint, { grant_type: "refresh_token", refresh_token: second.refresh_token, client_id: clientId });
  expect(afterDisconnect.status()).toBe(400);
});

test("a replayed refresh token revokes the whole grant", async ({ browser, request }) => {
  const registered = await request.post("/api/oauth/register", {
    headers: { "cf-connecting-ip": randomClientAddress() },
    data: { client_name: "E2E replay", redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: "none" },
  });
  const { client_id: clientId } = (await registered.json()) as { client_id: string };
  const page = await openPageAsNewClient(browser);
  const email = uniqueEmail("e2e-oauth");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });
  const pkce = createPkce();
  const query = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: REDIRECT_URI, code_challenge: pkce.challenge, code_challenge_method: "S256", scope: "mcp:read" });
  const redirect = await allowOnConsentPage(page, `/oauth/authorize?${query.toString()}`, { clientName: "E2E replay", isWriteRequested: false });
  const exchanged = await postForm(request, "/api/oauth/token", {
    grant_type: "authorization_code",
    code: redirect.searchParams.get("code") ?? "",
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: pkce.verifier,
  });
  const first = (await exchanged.json()) as TokenAnswer;
  expect(first.scope).toBe("mcp:read");
  expect((await listTools(request, first.access_token)).names).not.toContain("sign_guestbook");

  const second = (await (await postForm(request, "/api/oauth/token", { grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: clientId })).json()) as TokenAnswer;
  const replayed = await postForm(request, "/api/oauth/token", { grant_type: "refresh_token", refresh_token: first.refresh_token, client_id: clientId });
  expect(replayed.status()).toBe(400);
  expect((await listTools(request, second.access_token)).status).toBe(401);
});
