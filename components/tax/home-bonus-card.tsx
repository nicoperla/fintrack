"use client";

import { useState, type FormEvent } from "react";
import { Hammer, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { TaxSection, useAction } from "@/components/tax/ui";
import { deleteHomeBonus, saveHomeBonus } from "@/app/(dashboard)/730/actions";
import { HOME_BONUS_KINDS, type HomeBonus, type HomeBonusKind } from "@/lib/finance/rights";
import { HOME_BONUS_LABELS, defaultRate, type Instalment } from "@/lib/tax/home-bonus";
import type { ActionResult } from "@/lib/action-result";

/** Home bonuses in ten instalments: this year's, where to find them, and the list. */
export function HomeBonusCard({
  year,
  bonuses,
  instalments,
  mainHome,
}: {
  year: number;
  bonuses: HomeBonus[];
  instalments: Instalment[];
  mainHome: boolean;
}) {
  const money = useMoney();
  const { pending, run } = useAction();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<HomeBonusKind>("ristrutturazione");
  const [spentIn, setSpentIn] = useState(String(year));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const total = instalments.reduce((s, i) => s + i.amount, 0);
  const suggested = defaultRate(kind, Number(spentIn) || year, mainHome);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const res = await saveHomeBonus(null, {
      kind,
      year: spentIn,
      amount: String(form.get("amount") ?? ""),
      rate: String(form.get("rate") ?? ""),
      label: String(form.get("label") ?? ""),
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    setErrors(res.fieldErrors ?? {});
    if (res.ok) {
      toast.success("Aggiunto: ti ricordo la rata ogni anno");
      setAdding(false);
    } else if (res.error) toast.error(res.error);
  }

  return (
    <TaxSection
      id="bonus-casa"
      icon={Hammer}
      title="Bonus casa in dieci rate"
      subtitle="Ristrutturazione, risparmio energetico e mobili tornano in dieci anni: la rata va in ogni 730, e perderne una è facile."
      aside={
        !adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> Aggiungi lavori
          </Button>
        )
      }
    >
      {instalments.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm">
            Nel 730 del {year} ci vanno{" "}
            <span className="font-medium text-emerald-700 tabular-nums dark:text-emerald-400">
              {money(total)}
            </span>{" "}
            di rate. Controlla che nel precompilato ci siano tutte:
          </p>
          <ul className="divide-y text-sm">
            {instalments.map((i) => (
              <li key={i.bonus.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.bonus.label || HOME_BONUS_LABELS[i.bonus.kind]} · rata {i.number} di 10
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {money(i.bonus.amount)} spesi nel {i.bonus.year} al {i.bonus.rate}% · {i.where}
                  </p>
                </div>
                <span className="tabular-nums">{money(i.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label="Togli questi lavori"
                  onClick={() => run(() => deleteHomeBonus(i.bonus.id), "Tolto")}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !adding && (
          <p className="text-muted-foreground text-sm">
            {bonuses.length
              ? `Nessuna rata nel ${year}: i lavori che hai segnato sono fuori dai dieci anni.`
              : "Hai fatto lavori in casa negli ultimi dieci anni? Aggiungili: ti ricordo la rata e il rigo dove controllarla, ogni anno."}
          </p>
        )
      )}

      {adding && (
        <form onSubmit={onSubmit} className="grid gap-3 rounded-xl border p-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Che lavori</span>
              <NativeSelect
                value={kind}
                onChange={(e) => setKind(e.target.value as HomeBonusKind)}
                className="w-full"
              >
                {HOME_BONUS_KINDS.map((k) => (
                  <NativeSelectOption key={k} value={k}>
                    {HOME_BONUS_LABELS[k]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Un nome (facoltativo)</span>
              <Input name="label" placeholder="Es. Bagno, caldaia" maxLength={60} />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Anno in cui hai pagato</span>
              <Input
                inputMode="numeric"
                value={spentIn}
                onChange={(e) => setSpentIn(e.target.value)}
                aria-invalid={errors.year ? true : undefined}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Quanto hai speso (la tua parte)</span>
              <Input
                name="amount"
                inputMode="decimal"
                placeholder="Es. 12.000"
                aria-invalid={errors.amount ? true : undefined}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Percentuale</span>
              <Input
                key={suggested}
                name="rate"
                inputMode="decimal"
                defaultValue={String(suggested)}
                aria-invalid={errors.rate ? true : undefined}
              />
              <span className="text-muted-foreground text-xs">
                {kind === "mobili"
                  ? "50% su al massimo 5.000 €."
                  : `Di solito ${suggested}% per lavori pagati nel ${spentIn || year}${mainHome ? " sulla casa dove vivi" : ""}: controlla le fatture o il 730 dell'anno prima.`}
              </span>
            </label>
          </div>
          {Object.values(errors).flat().filter(Boolean).length > 0 && (
            <p className="text-destructive text-xs">
              {Object.values(errors).flat().filter(Boolean)[0]}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvo…" : "Aggiungi"}
            </Button>
          </div>
        </form>
      )}
    </TaxSection>
  );
}
