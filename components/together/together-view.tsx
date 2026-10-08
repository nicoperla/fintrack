"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Coffee, EyeOff, Handshake, House, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { createPersonalSpace, setShares } from "@/app/(dashboard)/insieme/actions";
import {
  SHARE_ITEMS,
  SHARE_LABELS,
  type PersonalSummary,
  type ShareItem,
} from "@/lib/finance/together";
import type { Together } from "@/lib/data/together";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

const failed = (): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." });
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Column({
  icon: Icon,
  title,
  note,
  children,
  tone = "default",
}: {
  icon: typeof House;
  title: string;
  note: string;
  children: ReactNode;
  tone?: "default" | "mine";
}) {
  return (
    <section
      className={cn(
        "bg-card grid content-start gap-4 rounded-2xl border p-5",
        tone === "mine" && "border-primary/40",
      )}
    >
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5" aria-hidden /> {title}
        </h2>
        <p className="text-muted-foreground text-xs">{note}</p>
      </div>
      {children}
    </section>
  );
}

const isEmpty = (s: PersonalSummary) =>
  s.balance === null && s.savings === null && s.investments === null && s.goals === null;

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-muted-foreground text-xs">{detail}</p>}
    </div>
  );
}

function GoalBars({ goals }: { goals: { name: string; progress: number }[] }) {
  return (
    <ul className="grid gap-2">
      {goals.slice(0, 4).map((g) => (
        <li key={g.name} className="grid gap-1">
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate">{g.name}</span>
            <span className="text-muted-foreground tabular-nums">{pct(g.progress)}</span>
          </div>
          <div className="bg-muted h-1.5 rounded-full">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${g.progress * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The figures of a personal space, only those present (the others weren't shared). */
function Summary({ summary }: { summary: PersonalSummary }) {
  const money = useMoney();
  const c = summary.currency;
  return (
    <div className="grid gap-4">
      {summary.balance !== null && (
        <Figure label="Sui conti personali" value={money(summary.balance, c)} />
      )}
      {summary.savings !== null && (
        <Figure
          label={`Messo da parte a ${summary.savings.month}`}
          value={money(summary.savings.saved, c)}
          detail={
            summary.savings.rate !== null ? `${pct(summary.savings.rate)} delle entrate` : undefined
          }
        />
      )}
      {summary.investments !== null && (
        <Figure label="Investimenti" value={money(summary.investments, c)} />
      )}
      {summary.goals !== null && (
        <div className="grid gap-2">
          <p className="text-muted-foreground text-sm">Obiettivi</p>
          <GoalBars goals={summary.goals} />
        </div>
      )}
    </div>
  );
}

function ShareChoices({ initial, others }: { initial: ShareItem[]; others: string }) {
  const [chosen, setChosen] = useState<ShareItem[]>(initial);
  const [pending, start] = useTransition();

  const toggle = (item: ShareItem) => {
    const next = chosen.includes(item) ? chosen.filter((x) => x !== item) : [...chosen, item];
    const previous = chosen;
    setChosen(next);
    start(async () => {
      const res = await setShares(next).catch(failed);
      if (!res.ok) {
        setChosen(previous);
        toast.error(res.error ?? "Salvataggio non riuscito. Riprova.");
      }
    });
  };

  return (
    <fieldset className="grid gap-2 border-t pt-4" disabled={pending}>
      <legend className="mb-2 text-sm font-medium">Cosa mostri a {others}</legend>
      {SHARE_ITEMS.map((item) => (
        <label key={item} className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={chosen.includes(item)}
            onChange={() => toggle(item)}
            className="accent-primary mt-0.5 size-4"
          />
          <span>
            {SHARE_LABELS[item].title}
            <span className="text-muted-foreground block text-xs">{SHARE_LABELS[item].text}</span>
          </span>
        </label>
      ))}
      <p className="text-muted-foreground mt-1 text-xs">
        Si cambia quando vuoi e nessuno riceve avvisi. I movimenti, i conti e i negozi non escono
        mai dal tuo spazio.
      </p>
    </fieldset>
  );
}

function NoPersonalSpace({ spaceName }: { spaceName: string }) {
  const [pending, start] = useTransition();
  const create = () =>
    start(async () => {
      const res = await createPersonalSpace().catch(failed);
      if (res.ok) toast.success("Fatto: il tuo spazio è nel selettore degli spazi, in alto");
      else toast.error(res.error ?? "Operazione non riuscita. Riprova.");
    });
  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">
        Non hai uno spazio solo tuo: i tuoi conti sono tutti in «{spaceName}». Succede a chi ha
        invitato l&apos;altro nel proprio spazio.
      </p>
      <p className="text-muted-foreground text-sm">
        Creane uno per i conti che vuoi tenere per te: dal selettore in alto passi da uno spazio
        all&apos;altro, e qui decidi cosa mostrarne.
      </p>
      <Button type="button" onClick={create} disabled={pending} className="justify-self-start">
        {pending ? "Un attimo…" : "Crea il tuo spazio personale"}
      </Button>
    </div>
  );
}

export function TogetherView({ data }: { data: Together }) {
  const money = useMoney();
  const names = data.others.map((o) => o.name);
  const othersText =
    names.length <= 1
      ? (names[0] ?? "gli altri")
      : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Column icon={House} title="Il nostro" note={`«${data.spaceName}»: lo vedete tutti.`}>
          <Figure label="Sui conti dello spazio" value={money(data.ours.balance)} />
          <Figure
            label={`Spese comuni di ${data.ours.monthName}`}
            value={money(data.ours.spentThisMonth)}
            detail="Senza quelle segnate come personali."
          />
          {data.ours.goals.length > 0 && (
            <div className="grid gap-2">
              <p className="text-muted-foreground text-sm">Obiettivi comuni</p>
              <GoalBars
                goals={data.ours.goals.map((g) => ({
                  name: g.name,
                  progress: g.target > 0 ? Math.min(1, g.current / g.target) : 0,
                }))}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Link href="/split" className="text-primary flex items-center gap-1 hover:underline">
              <Handshake className="size-4" aria-hidden /> Conti chiari
            </Link>
            <Link href="/caffe" className="text-primary flex items-center gap-1 hover:underline">
              <Coffee className="size-4" aria-hidden /> Il caffè dei conti
            </Link>
          </div>
        </Column>

        <Column
          icon={Lock}
          title="Il mio"
          note="Il tuo spazio personale: lo vedi solo tu."
          tone="mine"
        >
          {data.mine ? (
            <>
              {isEmpty(data.mine) ? (
                <p className="text-muted-foreground text-sm">
                  Il tuo spazio personale è ancora vuoto: passaci dal selettore in alto e aggiungi
                  un conto.
                </p>
              ) : (
                <Summary summary={data.mine} />
              )}
              <ShareChoices initial={data.myShares} others={othersText} />
            </>
          ) : (
            <NoPersonalSpace spaceName={data.spaceName} />
          )}
        </Column>

        <div className="grid content-start gap-4">
          {data.others.map((o) => (
            <Column
              key={o.name}
              icon={UserRound}
              title={`Di ${o.name}`}
              note={`Solo quello che ${o.name} sceglie di mostrarti.`}
            >
              {o.summary && !isEmpty(o.summary) ? (
                <Summary summary={o.summary} />
              ) : (
                <p className="text-muted-foreground flex items-start gap-2 text-sm">
                  <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {o.shares.length === 0
                    ? `${o.name} non mostra niente del suo spazio personale. Va bene così: è suo.`
                    : o.summary
                      ? `${o.name} ha scelto cosa mostrarti, ma per ora lì non c'è ancora niente.`
                      : `${o.name} non ha uno spazio personale da mostrare.`}
                </p>
              )}
            </Column>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Il nostro si divide in Conti chiari; il mio resta mio. Nessuna funzione qui serve a
        controllare l&apos;altro: ognuno decide da solo cosa mostrare, e può smettere quando vuole.
      </p>
    </div>
  );
}
