import Link from "next/link";
import { currencySymbol } from "@/lib/format";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelectOption } from "@/components/ui/native-select";
import { FormField, SelectField } from "@/components/forms/form-field";
import type { AccountOption, CategoryOption } from "@/lib/dto";
import type { TransactionFilters as Filters } from "@/lib/validations/finance";

type RawParams = Record<string, string | string[] | undefined>;

function raw(params: RawParams, key: string) {
  const v = params[key];
  return typeof v === "string" ? v : "";
}

export function TransactionFilters({
  params,
  filters,
  accounts,
  categories,
  currency,
}: {
  params: RawParams;
  filters: Filters;
  accounts: AccountOption[];
  categories: CategoryOption[];
  currency: string;
}) {
  const symbol = currencySymbol(currency);
  const advancedCount = [
    filters.type,
    filters.accountId,
    filters.categoryId,
    filters.from,
    filters.to,
    filters.min,
    filters.max,
  ].filter(Boolean).length;
  const hasAnyFilter = advancedCount > 0 || !!filters.q;

  return (
    <form action="/transactions" method="get" className="grid grid-cols-1 gap-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            type="search"
            name="q"
            defaultValue={raw(params, "q")}
            placeholder="Cerca descrizione, note o #tag"
            aria-label="Cerca movimenti"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="secondary">
          Cerca
        </Button>
      </div>

      <details className="group bg-card rounded-xl border" open={advancedCount > 0}>
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm select-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-medium">
            <SlidersHorizontal className="size-4" />
            Filtri
            {advancedCount > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs">
                {advancedCount}
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-xs group-open:hidden">Mostra</span>
          <span className="text-muted-foreground hidden text-xs group-open:inline">Nascondi</span>
        </summary>

        <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField label="Tipo" name="type" defaultValue={filters.type ?? ""}>
            <NativeSelectOption value="">Tutti</NativeSelectOption>
            <NativeSelectOption value="EXPENSE">Uscite</NativeSelectOption>
            <NativeSelectOption value="INCOME">Entrate</NativeSelectOption>
            <NativeSelectOption value="TRANSFER">Trasferimenti</NativeSelectOption>
          </SelectField>

          <SelectField label="Conto" name="accountId" defaultValue={filters.accountId ?? ""}>
            <NativeSelectOption value="">Tutti i conti</NativeSelectOption>
            {accounts.map((a) => (
              <NativeSelectOption key={a.id} value={a.id}>
                {a.name}
              </NativeSelectOption>
            ))}
          </SelectField>

          <div className="sm:col-span-2">
            <SelectField
              label="Categoria"
              name="categoryId"
              defaultValue={filters.categoryId ?? ""}
            >
              <NativeSelectOption value="">Tutte le categorie</NativeSelectOption>
              <NativeSelectOption value="none">Senza categoria</NativeSelectOption>
              {(["EXPENSE", "INCOME"] as const).map((type) => (
                <optgroup key={type} label={type === "EXPENSE" ? "Uscite" : "Entrate"}>
                  {categories
                    .filter((c) => c.type === type)
                    .flatMap((c) => [
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>,
                      ...c.children.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {`   ↳ ${ch.name}`}
                        </option>
                      )),
                    ])}
                </optgroup>
              ))}
            </SelectField>
          </div>

          <FormField label="Dal" name="from" type="date" defaultValue={raw(params, "from")} />
          <FormField label="Al" name="to" type="date" defaultValue={raw(params, "to")} />
          <FormField
            label={`Importo min (${symbol})`}
            name="min"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={raw(params, "min")}
          />
          <FormField
            label={`Importo max (${symbol})`}
            name="max"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={raw(params, "max")}
          />

          <div className="flex gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
            {hasAnyFilter && (
              <Link href="/transactions" className={buttonVariants({ variant: "ghost" })}>
                Reimposta
              </Link>
            )}
            <Button type="submit">Applica filtri</Button>
          </div>
        </div>
      </details>
    </form>
  );
}
