/**
 * Unit tests for Phase 2 daemon API endpoints.
 *
 * These tests mock @neondatabase/serverless so no real DB connection is needed.
 * Run with:  npx jest   (or pnpm test / npm test)
 */

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock @neondatabase/serverless before any route imports
// ---------------------------------------------------------------------------
const mockSql = jest.fn();
jest.mock("@neondatabase/serverless", () => ({
  neon: () => mockSql,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/agents/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// /api/agents/sync
// ---------------------------------------------------------------------------
describe("POST /api/agents/sync", () => {
  const { POST: syncPost } = require("../app/api/agents/sync/route");

  const fakeAgent = {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "user_1",
    machine_id: null,
    soul_config: "# My SOUL",
    status: "awaiting_connection",
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns 400 when body is missing fields", async () => {
    const res = await syncPost(makeRequest({ agentId: "abc" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/machineId/i);
  });

  it("returns 404 when agent does not exist", async () => {
    mockSql.mockResolvedValueOnce([]); // SELECT returns empty
    const res = await syncPost(
      makeRequest({ agentId: "no-such-id", machineId: "machine-1" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns soul config and tokens on success", async () => {
    mockSql
      .mockResolvedValueOnce([fakeAgent]) // SELECT
      .mockResolvedValueOnce([]);          // UPDATE

    const res = await syncPost(
      makeRequest({ agentId: fakeAgent.id, machineId: "machine-1" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.agentId).toBe(fakeAgent.id);
    expect(json.soulConfig).toBe("# My SOUL");
    expect(json.tokens).toHaveProperty("botRegistrationId");
    expect(json.tokens).toHaveProperty("messagingToken");
    expect(json.tokens).toHaveProperty("webhookSecret");
  });
});

// ---------------------------------------------------------------------------
// /api/agents/heartbeat
// ---------------------------------------------------------------------------
describe("POST /api/agents/heartbeat", () => {
  const { POST: heartbeatPost } = require("../app/api/agents/heartbeat/route");

  const fakeAgent = {
    id: "00000000-0000-0000-0000-000000000002",
    machine_id: "machine-99",
    status: "online",
  };

  beforeEach(() => jest.clearAllMocks());

  it("returns 400 for malformed body", async () => {
    const res = await heartbeatPost(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when agent not found", async () => {
    mockSql.mockResolvedValueOnce([]);
    const res = await heartbeatPost(
      makeRequest({ agentId: "ghost", machineId: "m1" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when machineId does not match", async () => {
    mockSql.mockResolvedValueOnce([fakeAgent]);
    const res = await heartbeatPost(
      makeRequest({ agentId: fakeAgent.id, machineId: "wrong-machine" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 ok and updates heartbeat on success", async () => {
    mockSql
      .mockResolvedValueOnce([fakeAgent]) // SELECT
      .mockResolvedValueOnce([]);          // UPDATE

    const res = await heartbeatPost(
      makeRequest({ agentId: fakeAgent.id, machineId: "machine-99" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.agentId).toBe(fakeAgent.id);
    expect(json.timestamp).toBeDefined();
  });
});
