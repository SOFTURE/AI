// The mailing package's RFC 8058 one-click route: the List-Unsubscribe header of every list mail
// points here. Public on purpose (proxy.ts protects only /account): mail clients post without a
// session.
export { getUnsubscribeRoute as GET, postUnsubscribeRoute as POST } from "@softure-ai/mailing/next";
