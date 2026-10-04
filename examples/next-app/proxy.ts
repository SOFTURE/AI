// The app's proxy: the blog's piece answers 301 for an old article slug and 410 for a withdrawn text
// (it may query the database, so it is awaited first); then the auth guard keeps visitors without a
// session cookie off /account, and the channel piece of @softure-ai/analytics carries the `?z=` tag
// through the guard's redirect and onto the next page a tagged page leads to. None sets a cookie.
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { createBlogRedirects } from "@softure-ai/blog/proxy";
import { NextResponse, type NextRequest } from "next/server";
import softureConfig from "./softure.config.ts";

const guard = createAuthGuard(softureConfig, { protect: ["/account"] });
const channels = createChannelTagger(softureConfig);
const blogRedirects = createBlogRedirects(softureConfig);

export async function proxy(request: NextRequest): Promise<Response> {
  return (await blogRedirects(request)) ?? channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next();
}

// Static files never need the guard or the tag.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
