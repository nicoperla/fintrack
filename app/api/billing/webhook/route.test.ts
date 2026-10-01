import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { POST } from "./route";

// vi.mock is hoisted above the imports: the mock it uses must be hoisted too.
const { syncSubscription } = vi.hoisted(() => ({ syncSubscription: vi.fn() }));
vi.mock("@/lib/billing/stripe", async () => {
  const { default: StripeSdk } = await import("stripe");
  const client = new StripeSdk("sk_test_fake");
  return { stripe: () => client, syncSubscription };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { updateMany: vi.fn() } } }));

const SECRET = "whsec_test_secret";
const event = {
  id: "evt_1",
  object: "event",
  type: "customer.subscription.updated",
  data: { object: { id: "sub_1", object: "subscription", status: "active" } },
};

function request(body: string, signature: string) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
    syncSubscription.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a request with a forged signature", async () => {
    const res = await POST(request(JSON.stringify(event), "t=1,v1=deadbeef"));
    expect(res.status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("syncs the subscription of a signed event", async () => {
    const payload = JSON.stringify(event);
    const signature = new Stripe("sk_test_fake").webhooks.generateTestHeaderString({
      payload,
      secret: SECRET,
    });
    const res = await POST(request(payload, signature));
    expect(res.status).toBe(200);
    expect(syncSubscription).toHaveBeenCalledWith(expect.objectContaining({ id: "sub_1" }));
  });
});
