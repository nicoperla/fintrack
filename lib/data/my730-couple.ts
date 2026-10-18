import { prisma } from "@/lib/db/prisma";
import { rulesFor } from "@/lib/tax/rules";
import { capacityOf, readCu, taxRoom, type Capacity } from "@/lib/tax/simulate";
import { readSituation } from "@/lib/tax/situation";

/*
 * "Chi detrae cosa", in a shared space. Each person decides whether the others may see their
 * "capienza" (whether there's IRPEF left for the expense deductions): never an amount, never an
 * expense, only "none / low / enough". With both, Orbitly says in whose 730 the children's
 * expenses are worth more.
 */

export type CoupleMember = { name: string; capacity: Capacity | "unknown" | "hidden" };

export type CoupleView = {
  share: boolean;
  mine: Capacity | "unknown";
  others: CoupleMember[];
  advice: string | null;
};

export async function getCoupleView(input: {
  userId: string;
  householdId: string;
  year: number;
  /** This person's room and expense deductions, from getMy730's simulation. */
  myRoom: number | null;
  myExpenses: number;
  share: boolean;
}): Promise<CoupleView | null> {
  const members = await prisma.householdMember.findMany({
    where: { householdId: input.householdId, userId: { not: input.userId } },
    select: {
      user: {
        select: {
          name: true,
          email: true,
          taxYears: {
            where: { year: input.year },
            select: { shareCapacity: true, cu: true, answers: true },
          },
        },
      },
    },
  });
  if (!members.length) return null;

  const rules = rulesFor(input.year);
  const others: CoupleMember[] = members.map(({ user }) => {
    const name = user.name?.split(" ")[0] || user.email.split("@")[0];
    const row = user.taxYears[0];
    if (!row?.shareCapacity) return { name, capacity: "hidden" };
    const room = taxRoom(readCu(row.cu), readSituation(row.answers), rules);
    return { name, capacity: room === null ? "unknown" : capacityOf(room) };
  });
  const mine = input.myRoom === null ? "unknown" : capacityOf(input.myRoom, input.myExpenses);

  let advice: string | null = null;
  if (input.share) {
    const strong = others.find((o) => o.capacity === "enough");
    const weak = others.find((o) => o.capacity === "none" || o.capacity === "low");
    if ((mine === "none" || mine === "low") && strong) {
      advice = `Le spese dei figli a carico (scuola, sport, nido, visite) rendono di più nel 730 di ${strong.name}: tu rischi di perderne una parte.`;
    } else if (mine === "enough" && weak) {
      advice = `Le spese dei figli a carico conviene metterle nel tuo 730: ${weak.name} ha poca imposta e ne perderebbe una parte.`;
    } else if (mine === "enough" && strong) {
      advice =
        "Avete tutti e due abbastanza imposta: dividete le spese dei figli come vi è più comodo.";
    }
  }
  return { share: input.share, mine, others, advice };
}
