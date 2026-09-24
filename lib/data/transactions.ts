import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { TransactionFilters } from "@/lib/validations/finance";

export const TRANSACTIONS_PAGE_SIZE = 25;

async function buildWhere(userId: string, f: TransactionFilters) {
  const and: Prisma.TransactionWhereInput[] = [];

  if (f.type) and.push({ type: f.type });
  if (f.accountId) {
    and.push({ OR: [{ accountId: f.accountId }, { transferAccountId: f.accountId }] });
  }
  if (f.categoryId === "none") {
    and.push({ categoryId: null, type: { not: "TRANSFER" } });
  } else if (f.categoryId) {
    // Filtering by a parent category includes its subcategories.
    const children = await prisma.category.findMany({
      where: { userId, parentId: f.categoryId },
      select: { id: true },
    });
    and.push({ categoryId: { in: [f.categoryId, ...children.map((c) => c.id)] } });
  }
  if (f.from || f.to) and.push({ date: { gte: f.from, lte: f.to } });
  if (f.min || f.max) and.push({ amount: { gte: f.min, lte: f.max } });
  if (f.q) {
    and.push({
      OR: [
        { description: { contains: f.q, mode: "insensitive" } },
        { notes: { contains: f.q, mode: "insensitive" } },
        { tags: { has: f.q.toLowerCase().replace(/^#/, "") } },
      ],
    });
  }

  return { userId, AND: and } satisfies Prisma.TransactionWhereInput;
}

export async function listTransactions(userId: string, filters: TransactionFilters) {
  const where = await buildWhere(userId, filters);

  const [total, sums] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / TRANSACTIONS_PAGE_SIZE));
  const page = Math.min(filters.page ?? 1, pageCount);

  const items = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
    take: TRANSACTIONS_PAGE_SIZE,
    include: {
      account: { select: { id: true, name: true } },
      transferAccount: { select: { id: true, name: true } },
      category: {
        select: {
          id: true,
          name: true,
          icon: true,
          color: true,
          parent: { select: { name: true } },
        },
      },
    },
  });

  const sumOf = (type: "INCOME" | "EXPENSE") =>
    sums.find((s) => s.type === type)?._sum.amount ?? new Prisma.Decimal(0);

  return {
    items,
    total,
    page,
    pageCount,
    income: sumOf("INCOME"),
    expense: sumOf("EXPENSE"),
  };
}

export type TransactionListItem = Awaited<ReturnType<typeof listTransactions>>["items"][number];
