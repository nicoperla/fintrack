import type { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CategoryNode = {
  id: string;
  name: string;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  transactionCount: number;
  children: CategoryNode[];
};

export async function getCategoryTree(householdId: string) {
  const rows = await prisma.category.findMany({
    where: { householdId },
    orderBy: { name: "asc" },
    include: { _count: { select: { transactions: true } } },
  });

  const nodes = new Map<string, CategoryNode>(
    rows.map((c) => [
      c.id,
      {
        id: c.id,
        name: c.name,
        type: c.type,
        icon: c.icon,
        color: c.color,
        parentId: c.parentId,
        transactionCount: c._count.transactions,
        children: [],
      },
    ]),
  );

  const roots: CategoryNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  return {
    expense: roots.filter((c) => c.type === "EXPENSE"),
    income: roots.filter((c) => c.type === "INCOME"),
  };
}

export type CategoryTree = Awaited<ReturnType<typeof getCategoryTree>>;
