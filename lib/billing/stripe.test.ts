import { describe, expect, it } from "vitest";
import { planFromSubscription } from "./stripe";

const sub = (
  status: string,
  extra: Partial<{ cancel_at_period_end: boolean; cancel_at: number | null }> = {},
) => ({
  status: status as never,
  cancel_at_period_end: false,
  cancel_at: null,
  items: { data: [{ current_period_end: 1_790_000_000 }] },
  ...extra,
});

describe("planFromSubscription", () => {
  it("gives Pro to active and trialing subscriptions", () => {
    expect(planFromSubscription(sub("active")).plan).toBe("PRO");
    expect(planFromSubscription(sub("trialing")).plan).toBe("PRO");
  });

  it("keeps Pro while Stripe retries a failed renewal", () => {
    expect(planFromSubscription(sub("past_due")).plan).toBe("PRO");
  });

  it("goes back to free when cancelled or unpaid", () => {
    expect(planFromSubscription(sub("canceled")).plan).toBe("FREE");
    expect(planFromSubscription(sub("unpaid")).plan).toBe("FREE");
    expect(planFromSubscription(sub("incomplete_expired")).plan).toBe("FREE");
  });

  it("reads the period end from the subscription item", () => {
    expect(planFromSubscription(sub("active")).planRenewsAt?.toISOString()).toBe(
      new Date(1_790_000_000 * 1000).toISOString(),
    );
  });

  it("flags a cancellation at the end of the period", () => {
    expect(
      planFromSubscription(sub("active", { cancel_at_period_end: true })).planCancelsAtEnd,
    ).toBe(true);
    expect(planFromSubscription(sub("active", { cancel_at: 1_790_000_000 })).planCancelsAtEnd).toBe(
      true,
    );
    expect(planFromSubscription(sub("active")).planCancelsAtEnd).toBe(false);
  });
});
