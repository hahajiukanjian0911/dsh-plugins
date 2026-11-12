import { TypertGatewayService } from "@deepseek-ai/dsh-api-gateway";
// The real installed-version Gateway performs source discovery, argument and result
// validation, invocation-context rebinding, and owner access checks. Only the empty
// generated registry and access-policy decisions are fixtures.
export function gatewayFor(service) {
  const ctx = service.ctx;
  ctx.provide("typert", {
    local: { get: () => undefined, hasSeen: () => false },
    lookups: { definitions: () => [] },
    resources: { entries: () => [] },
  });
  ctx.provide("remoteAccess", {
    decide: () => ({ kind: "deny", reason: "owner-only" }),
  });
  return new TypertGatewayService(ctx, {
    websocketHeartbeatIntervalMs: 30000,
    streamInboxBytes: 1024 * 1024,
    websocketCompression: "none",
  });
}
export const ownerPeer = {
  principal: { kind: "owner" },
  signal: new AbortController().signal,
};
