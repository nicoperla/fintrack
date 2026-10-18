import { prisma } from "@/lib/db/prisma";
import { JOURNEYS, journeyByKey } from "@/lib/journeys/catalog";
import { docStatus, isDocKind, daysUntil } from "@/lib/journeys/documents";
import { journeyProgress } from "@/lib/journeys/progress";
import { todayInAppTimeZone, utcDate } from "@/lib/dates";
import { toDateInputValue } from "@/lib/format";

function today() {
  const t = todayInAppTimeZone();
  return toDateInputValue(utcDate(t.year, t.month, t.day));
}

/** "Percorsi e scadenze": the person's journeys with their progress, and their documents. */
export async function getJourneys(userId: string) {
  const now = today();
  const [rows, docs] = await Promise.all([
    prisma.userJourney.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.personalDocument.findMany({ where: { userId }, orderBy: { expiresOn: "asc" } }),
  ]);
  const active = rows.flatMap((row) => {
    const journey = journeyByKey(row.key);
    if (!journey) return [];
    const eventDate = toDateInputValue(row.eventDate);
    return [{ journey, eventDate, ...journeyProgress(journey, eventDate, row.done, now) }];
  });
  return {
    today: now,
    active,
    available: JOURNEYS.filter((j) => !rows.some((r) => r.key === j.key)),
    documents: docs.flatMap((d) => {
      if (!isDocKind(d.kind)) return [];
      const expiresOn = toDateInputValue(d.expiresOn);
      return [
        {
          id: d.id,
          kind: d.kind,
          label: d.label,
          expiresOn,
          days: daysUntil(now, expiresOn),
          status: docStatus(d.kind, expiresOn, now),
        },
      ];
    }),
  };
}

export type JourneysData = Awaited<ReturnType<typeof getJourneys>>;

/** One journey, started or not. */
export async function getJourney(userId: string, key: string) {
  const journey = journeyByKey(key);
  if (!journey) return null;
  const now = today();
  const row = await prisma.userJourney.findUnique({
    where: { userId_key: { userId, key: journey.key } },
  });
  const eventDate = row ? toDateInputValue(row.eventDate) : null;
  return {
    today: now,
    journey,
    eventDate,
    progress: eventDate ? journeyProgress(journey, eventDate, row!.done, now) : null,
  };
}

export type JourneyData = NonNullable<Awaited<ReturnType<typeof getJourney>>>;
