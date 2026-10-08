"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { Landmark, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField, FormMessage } from "@/components/forms/form-field";
import {
  Card,
  DistributionBar,
  Moves,
  Section,
  VerdictBadge,
  VerdictBox,
  useWholeMoney,
  type Move,
} from "@/components/tariffs/tariff-ui";
import { saveBankAccount } from "@/app/(dashboard)/ritrovati/tariffometro/actions";
import { BANK_ACCOUNTS, BANK_ACCOUNT_KINDS, type BankAccountKind } from "@/lib/finance/tariff-data";
import { MIN_MONTHS_FOR_FEES, positionText } from "@/lib/finance/tariffs";
import type { Tariffometro } from "@/lib/data/tariffs";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type AccountItem = Tariffometro["bankAccounts"][number];

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const toInput = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));
const { kinds, stampDuty } = BANK_ACCOUNTS;
const euros = (n: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    useGrouping: "always",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
// Set by law in euro, the same for everyone: not one of the user's amounts.
const STAMP_DUTY_TEXT = `${euros(stampDuty.yearly)} l'anno quando la giacenza media supera ${euros(stampDuty.threshold)}`;

export function BankSection({ data }: { data: Tariffometro }) {
  const [editing, setEditing] = useState<AccountItem | null>(null);
  return (
    <Section
      id="conto"
      icon={Landmark}
      title="Conto corrente"
      subtitle={`Quanto ti costa il conto in un anno, contro quanto spendono le famiglie italiane (Banca d'Italia, dati del ${BANK_ACCOUNTS.year}).`}
    >
      {data.bankAccounts.length === 0 ? (
        <Card className="justify-items-start">
          <p className="text-sm">
            Non hai conti correnti in FinTrack. Aggiungine uno, con i suoi movimenti: le commissioni
            le trovo da lì.
          </p>
          <Link href="/accounts" className={buttonVariants({ variant: "outline" })}>
            Vai ai conti
          </Link>
        </Card>
      ) : (
        data.bankAccounts.map((item) => (
          <AccountCard
            key={item.accountId}
            item={item}
            data={data}
            onEdit={() => setEditing(item)}
          />
        ))
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
          {editing && (
            <AccountForm key={editing.accountId} item={editing} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function AccountCard({
  item,
  data,
  onEdit,
}: {
  item: AccountItem;
  data: Tariffometro;
  onEdit: () => void;
}) {
  const money = useMoney();
  const wholeMoney = useWholeMoney();
  const [pending, start] = useTransition();
  const c = item.comparison;

  const chooseKind = (kind: BankAccountKind) =>
    start(async () => {
      const res = await saveBankAccount({
        accountId: item.accountId,
        accountKind: kind,
        yearly: toInput(item.typed),
      }).catch(failed);
      if (res.ok) toast.success("Fatto: ecco il confronto");
      else toast.error(res.error ?? "Salvataggio non riuscito. Riprova.");
    });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{item.name}</p>
          <p className="text-muted-foreground text-sm">
            {item.source === "statement"
              ? `${money(item.yearly!)} l'anno, dal Riepilogo delle spese`
              : item.source === "movements"
                ? `${money(item.yearly!)} in un anno, da ${item.costs.count === 1 ? "1 addebito" : `${item.costs.count} addebiti`} della banca${item.costs.months < 12 ? ` (stima su ${item.costs.months} mesi interi)` : ""}`
                : item.tooRecent
                  ? "Ancora pochi movimenti per stimare un anno"
                  : "Nessuna commissione tra i movimenti"}
            {item.kind && ` · ${kinds[item.kind].label.toLowerCase()}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label={`Modifica ${item.name}`}
        >
          <Pencil />
        </Button>
      </div>

      {!item.kind && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Che conto è?</p>
          <div className="flex flex-wrap gap-2">
            {BANK_ACCOUNT_KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => chooseKind(k)}
              >
                {kinds[k].label}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            I conti online e quelli in filiale costano in modo molto diverso: li confronto con i
            loro simili.
          </p>
        </div>
      )}

      {c ? (
        <>
          <VerdictBox verdict={c.verdict}>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {c.verdict === "above"
                ? `Paghi ${money(c.over)} in più della media dei ${kinds[c.kind].short}.`
                : c.verdict === "below"
                  ? `Paghi ${money(c.mean - item.yearly!)} meno della media dei ${kinds[c.kind].short}.`
                  : `Sei in linea con la media dei ${kinds[c.kind].short}.`}
              <VerdictBadge verdict={c.verdict} />
            </p>
            <p className="text-muted-foreground">
              {positionText(c.share, "correntisti")} con un conto come il tuo. La media è{" "}
              {money(c.mean)} l&apos;anno.
            </p>
          </VerdictBox>
          <DistributionBar
            value={item.yearly!}
            mean={c.mean}
            percentiles={c.percentiles}
            low={10}
            high={90}
            format={wholeMoney}
            label={`Il tuo conto costa ${money(item.yearly!)} l'anno; la media dei ${kinds[c.kind].short} è ${money(c.mean)}.`}
          />
          {c.kind !== "online" && c.overOnline > 0 && (
            <p className="text-sm">
              In media un conto online costa {money(kinds.online.mean)} l&apos;anno:{" "}
              {money(c.overOnline)} meno del tuo.
            </p>
          )}
        </>
      ) : (
        item.kind &&
        item.yearly === null && (
          <div className="bg-muted/40 grid justify-items-start gap-2 rounded-xl p-3 text-sm">
            <p>
              {item.tooRecent
                ? `Per stimare quanto costa in un anno mi servono almeno ${MIN_MONTHS_FOR_FEES} mesi interi di movimenti. Intanto puoi scrivere il totale del «Riepilogo delle spese», che la banca ti manda ogni anno.`
                : "Non vedo commissioni tra i movimenti. Se il conto è gratis, perfetto; se no, scrivi il totale del «Riepilogo delle spese», che la banca ti manda ogni anno."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              Scrivi il costo
            </Button>
          </div>
        )
      )}
      {!data.euro && item.yearly !== null && (
        <p className="bg-muted/40 rounded-xl p-3 text-sm">
          I dati della Banca d&apos;Italia sono in euro: il confronto vale per gli spazi in euro.
        </p>
      )}

      {item.costs.stampDuty > 0 && (
        <p className="text-muted-foreground text-xs">
          In più c&apos;è l&apos;imposta di bollo ({money(item.costs.stampDuty)} in un anno): è una
          tassa, uguale in tutte le banche ({STAMP_DUTY_TEXT}), e non entra nel confronto.
        </p>
      )}

      {item.kind && <Moves open={c?.verdict === "above"} moves={bankMoves(item)} />}
    </Card>
  );
}

function bankMoves(item: AccountItem): Move[] {
  const moves: Move[] = [
    {
      text: "Per ogni conto le banche pubblicano il «Documento informativo sulle spese», con l'Indicatore dei costi complessivi (ICC) per profilo d'uso: confronta quello del tuo profilo con quanto spendi oggi.",
    },
    {
      text: "Il trasferimento è gratis e lo fa la nuova banca: stipendio, domiciliazioni e saldo passano entro 12 giorni lavorativi, e se tarda ti deve un indennizzo (d.lgs. 37/2017).",
    },
    {
      text: "Chiudere il conto non costa niente: niente penali né spese di chiusura (art. 126-septies del Testo unico bancario).",
    },
  ];
  if (item.costs.count > 0) {
    moves.push({
      text: "Una commissione che non ti torna? Contestala con un reclamo: la lettera te la preparo io.",
      href: "/ritrovati/pratiche/nuova?ritrovato=fees",
      linkLabel: "Apri un reclamo",
    });
  }
  return moves;
}

function AccountForm({ item, onDone }: { item: AccountItem; onDone: () => void }) {
  const money = useMoney();
  const [kind, setKind] = useState<BankAccountKind | null>(item.kind);
  const [yearly, setYearly] = useState(toInput(item.typed));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, setPending] = useState(false);
  const errors = result?.fieldErrors;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const res = await saveBankAccount({
      accountId: item.accountId,
      accountKind: kind ?? "",
      yearly,
    }).catch(failed);
    setPending(false);
    if (!res.ok) {
      setResult(res);
      return;
    }
    toast.success("Conto aggiornato");
    onDone();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{item.name}</DialogTitle>
        <DialogDescription>
          Che conto è, e se vuoi il costo esatto dell&apos;anno: lo confronto con i conti simili.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4" noValidate>
        {result?.error && <FormMessage tone="error">{result.error}</FormMessage>}
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Che conto è</legend>
          {BANK_ACCOUNT_KINDS.map((k) => (
            <label
              key={k}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm",
                kind === k ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="accountKind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="accent-primary size-4"
                />
                {kinds[k].label}
              </span>
              <span className="text-muted-foreground text-xs">
                in media {money(kinds[k].mean)} l&apos;anno
              </span>
            </label>
          ))}
          {errors?.accountKind && (
            <p className="text-destructive text-sm">{errors.accountKind[0]}</p>
          )}
        </fieldset>
        <FormField
          label="Costo in un anno, dal «Riepilogo delle spese» (€)"
          name="yearly"
          inputMode="decimal"
          placeholder={item.costs.count > 0 ? toInput(item.costs.yearly) : "0,00"}
          value={yearly}
          onChange={(e) => setYearly(e.target.value)}
          hint="Facoltativo, senza l'imposta di bollo. Vuoto: lo calcolo dalle commissioni tra i movimenti."
          className="tabular-nums"
          errors={errors?.yearly}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
            Annulla
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Un attimo…" : "Salva"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
