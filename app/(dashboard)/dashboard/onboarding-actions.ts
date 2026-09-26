"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireSpace } from "@/lib/auth/session";
import { type ActionResult, validationError } from "@/lib/action-result";
import { accountSchema } from "@/lib/validations/finance";
import { DEFAULT_CATEGORIES } from "@/lib/defaults/categories";

const DEFAULT_NAMES = DEFAULT_CATEGORIES.map((c) => c.name);

const onboardingSchema = z.object({
  account: accountSchema,
  categories: z.array(z.string()).max(DEFAULT_NAMES.length),
});

export type OnboardingResult = ActionResult & {
  context?: {
    account: { id: string; name: string; type: string };
    categories: { id: string; name: string; type: "INCOME" | "EXPENSE" }[];
  };
};

/**
 * Creates the first account and, if the user has none yet, the chosen starter categories.
 * Idempotent: a double submit won't create a second account.
 */
export async function completeOnboarding(input: unknown): Promise<OnboardingResult> {
  const space = await requireSpace();
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const chosen = DEFAULT_CATEGORIES.filter((c) => parsed.data.categories.includes(c.name));

  await prisma.$transaction(async (tx) => {
    const hasAccount = await tx.financialAccount.count({ where: { householdId: space.id } });
    if (!hasAccount) {
      await tx.financialAccount.create({
        data: {
          ...parsed.data.account,
          currency: parsed.data.account.currency ?? space.currency,
          householdId: space.id,
          userId: space.user.id,
        },
      });
    }
    const hasCategories = await tx.category.count({ where: { householdId: space.id } });
    if (hasCategories) return;
    for (const cat of chosen) {
      const parent = await tx.category.create({
        data: {
          householdId: space.id,
          userId: space.user.id,
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          color: cat.color,
        },
      });
      if (cat.children?.length) {
        await tx.category.createMany({
          data: cat.children.map((child) => ({
            householdId: space.id,
            userId: space.user.id,
            name: child.name,
            type: cat.type,
            icon: child.icon,
            color: cat.color,
            parentId: parent.id,
          })),
        });
      }
    }
  });

  const [account, categories] = await Promise.all([
    prisma.financialAccount.findFirstOrThrow({
      where: { householdId: space.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.category.findMany({
      where: { householdId: space.id },
      select: { id: true, name: true, type: true },
    }),
  ]);

  return {
    ok: true,
    context: {
      account,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type === "INCOME" ? "INCOME" : "EXPENSE",
      })),
    },
  };
}

export async function finishOnboarding() {
  revalidatePath("/", "layout");
}
