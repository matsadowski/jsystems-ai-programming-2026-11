// Fails every outbound network call made from unit/integration tests (ADR 002 TAC-002-02,
// ADR 004 TAC-004-03). External services are replaced by fakes built from real captures.
import http from "node:http";
import https from "node:https";

export const NETWORK_DISABLED_MESSAGE = "network disabled in tests";

function blocked(): never {
  throw new Error(NETWORK_DISABLED_MESSAGE);
}

globalThis.fetch = (async () => {
  throw new Error(NETWORK_DISABLED_MESSAGE);
}) as typeof fetch;

for (const mod of [http, https]) {
  mod.request = blocked as unknown as typeof mod.request;
  mod.get = blocked as unknown as typeof mod.get;
}
