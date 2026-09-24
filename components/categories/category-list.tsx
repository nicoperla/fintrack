"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import {
  CategoryFormDialog,
  type EditableCategory,
} from "@/components/categories/category-form-dialog";
import { deleteCategory } from "@/app/(dashboard)/categories/actions";
import { CategoryIcon } from "@/lib/category-style";
import type { CategoryNode } from "@/lib/data/categories";

type ParentOption = { id: string; name: string; type: "INCOME" | "EXPENSE" };

function toEditable(node: CategoryNode): EditableCategory {
  return {
    id: node.id,
    name: node.name,
    type: node.type === "INCOME" ? "INCOME" : "EXPENSE",
    icon: node.icon,
    color: node.color,
    parentId: node.parentId,
  };
}

function countLabel(n: number) {
  return n === 1 ? "1 movimento" : `${n} movimenti`;
}

function CategoryRow({
  node,
  parents,
  isChild,
}: {
  node: CategoryNode;
  parents: ParentOption[];
  isChild?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const childTransactions = node.children.reduce((sum, c) => sum + c.transactionCount, 0);

  const deleteDescription = [
    node.children.length > 0 &&
      (node.children.length === 1
        ? "Verrà eliminata anche la sottocategoria."
        : `Verranno eliminate anche le ${node.children.length} sottocategorie.`),
    node.transactionCount + childTransactions > 0 &&
      (node.transactionCount + childTransactions === 1
        ? "Il movimento collegato resterà, ma senza categoria."
        : `I ${node.transactionCount + childTransactions} movimenti collegati resteranno, ma senza categoria.`),
    "L'operazione non è reversibile.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={isChild ? "pl-10" : undefined}>
      <div className="flex items-center gap-3 py-2">
        <CategoryIcon name={node.icon} color={node.color} size={isChild ? "sm" : "md"} />
        <div className="min-w-0 flex-1">
          <p className={isChild ? "truncate text-sm" : "truncate font-medium"}>{node.name}</p>
          <Link
            href={`/transactions?categoryId=${node.id}`}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            {countLabel(node.transactionCount + childTransactions)}
          </Link>
        </div>
        <div className="flex">
          {!isChild && (
            <CategoryFormDialog
              parents={parents}
              defaults={{
                type: node.type === "INCOME" ? "INCOME" : "EXPENSE",
                parentId: node.id,
                color: node.color,
              }}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Aggiungi sottocategoria a ${node.name}`}
                >
                  <Plus />
                </Button>
              }
            />
          )}
          <CategoryFormDialog
            category={toEditable(node)}
            parents={parents}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Modifica ${node.name}`}>
                <Pencil />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Elimina ${node.name}`}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {node.children.map((child) => (
        <CategoryRow key={child.id} node={child} parents={parents} isChild />
      ))}
      <ConfirmDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Eliminare "${node.name}"?`}
        description={deleteDescription}
        successMessage="Categoria eliminata"
        onConfirm={() => deleteCategory(node.id)}
      />
    </div>
  );
}

export function CategoryList({
  title,
  type,
  roots,
  parents,
}: {
  title: string;
  type: "INCOME" | "EXPENSE";
  roots: CategoryNode[];
  parents: ParentOption[];
}) {
  return (
    <section className="bg-card rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        <CategoryFormDialog
          parents={parents}
          defaults={{ type }}
          trigger={
            <Button variant="outline" size="sm">
              <Plus data-icon="inline-start" />
              Nuova
            </Button>
          }
        />
      </div>
      <div className="divide-y px-4">
        {roots.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nessuna categoria. Creane una per organizzare i movimenti.
          </p>
        ) : (
          roots.map((node) => <CategoryRow key={node.id} node={node} parents={parents} />)
        )}
      </div>
    </section>
  );
}
