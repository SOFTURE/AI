// The app's proxy: the auth guard keeps visitors without a session cookie off /account, then the
// channel piece of @softure-ai/analytics carries the `?z=` tag through the guard's redirect and onto
// the next page a tagged page leads to. Neither sets a cookie.
import { createChannelTagger } from "@softure-ai/analytics/proxy";
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { NextResponse, type NextRequest } from "next/server";
import softureConfig from "./softure.config.ts";

const guard = createAuthGuard(softureConfig, { protect: ["/account"] });
const channels = createChannelTagger(softureConfig);

export function proxy(request: NextRequest): Response {
  return channels.carry(request, guard(request)) ?? channels.tag(request) ?? NextResponse.next();
}

// Static files never need the guard or the tag.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
