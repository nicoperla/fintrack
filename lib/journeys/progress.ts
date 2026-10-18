import { daysUntil } from "@/lib/journeys/documents";
import type { Journey, JourneyStep } from "@/lib/journeys/catalog";

/*
 * Where someone is on a journey: each step with its date (the event plus the step's days), done
 * or not, late or not, and the next one to do.
 */

export type StepState = "done" | "late" | "soon" | "open";

export type StepProgress = JourneyStep & {
  /** The deadline, when the step has one. */
  due: string | null;
  /** Days to the deadline (negative: late). */
  days: number | null;
  state: StepState;
};

const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function journeyProgress(
  journey: Journey,
  eventDate: string,
  done: string[],
  today: string,
) {
  const steps: StepProgress[] = journey.steps.map((step) => {
    const due = step.dueDays === undefined ? null : addDays(eventDate, step.dueDays);
    const days = due === null ? null : daysUntil(today, due);
    const state: StepState = done.includes(step.key)
      ? "done"
      : days !== null && days < 0
        ? "late"
        : days !== null && days <= 14
          ? "soon"
          : "open";
    return { ...step, due, days, state };
  });
  // Deadlines first, nearest first; then the steps without a date, in their order.
  const open = steps.filter((s) => s.state !== "done");
  const next =
    [...open].filter((s) => s.days !== null).sort((a, b) => a.days! - b.days!)[0] ??
    open[0] ??
    null;
  return {
    steps,
    next,
    done: steps.filter((s) => s.state === "done").length,
    total: steps.length,
    late: steps.filter((s) => s.state === "late").length,
  };
}

/** Steps with a deadline within `days` (or already late), for the weekly summary. */
export function upcomingSteps(
  journey: Journey,
  eventDate: string,
  done: string[],
  today: string,
  days = 7,
) {
  return journeyProgress(journey, eventDate, done, today).steps.filter(
    (s) => s.state !== "done" && s.days !== null && s.days <= days && s.days >= -30,
  );
}
