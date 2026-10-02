// The app's proxy: the auth guard keeps visitors without a session cookie off /account. Other
// pieces (channel tagging, later) chain after it with `??`.
import { createAuthGuard } from "@softure-ai/auth/proxy";
import { NextResponse, type NextRequest } from "next/server";
import softureConfig from "./softure.config.ts";

const guard = createAuthGuard(softureConfig, { protect: ["/account"] });

export function proxy(request: NextRequest): Response {
  return guard(request) ?? NextResponse.next();
}

// Static files never need the guard.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
