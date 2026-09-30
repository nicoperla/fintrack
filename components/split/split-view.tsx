"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CircleCheck, Handshake, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAmountsHidden, useMoney } from "@/components/currency-provider";
import { CategoryIcon } from "@/lib/category-style";
import type { SplitData } from "@/lib/data/split";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import {
  deleteSettlement,
  recordSettlement,
  setExpensePersonal,
  updateSplitSettings,
} from "@/app/(dashboard)/split/actions";

const MEMBER_COLORS = ["var(--viz-income)", "var(--viz-expense)", "#8b5cf6", "#10b981", "#eab308"];

const shortDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const fmt = (iso: string, f = shortDate) => f.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");
const axisNumber = new Intl.NumberFormat("it-IT", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "lg" ? "size-14 text-xl" : "size-8 text-sm",
      )}
      style={{ background: color }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

async function run(action: Promise<ActionResult>, success: string) {
  const res = await action.catch((): ActionResult => ({
    ok: false,
    error: "Operazione non riuscita. Riprova.",
  }));
  if (res.ok) toast.success(success);
  else toast.error(res.error ?? "Controlla i dati inseriti.");
  return res.ok;
}

export function SplitView({ data, currentUserId }: { data: SplitData; currentUserId: string }) {
  const money = useMoney();
  const hidden = useAmountsHidden();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState(data.setting);
  const [since, setSince] = useState(data.since);

  const colorOf = new Map(
    data.members.map((m, i) => [m.userId, MEMBER_COLORS[i % MEMBER_COLORS.length]]),
  );
  const nameOf = new Map(data.members.map((m) => [m.userId, m.name]));
  const you = (id: string) => id === currentUserId;
  const settingsChanged = mode !== data.setting || since !== data.since;

  return (
    <div className="grid gap-6">
      <section
        className="bg-card relative grid gap-5 overflow-hidden rounded-2xl border p-5 sm:p-6"
        aria-label="Chi deve a chi"
      >
        <p className="text-muted-foreground text-sm">
          Spese comuni dal {fmt(data.since, longDate)}:{" "}
          <span className="text-foreground font-medium tabular-nums">{money(data.total)}</span>
        </p>
        {data.transfers.length === 0 ? (
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-(--delta-good)/15 text-(--delta-good)">
              <CircleCheck className="size-7" aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-semibold tracking-tight">Siete pari</p>
              <p className="text-muted-foreground text-sm">
                Nessuno deve niente a nessuno. Che armonia.
              </p>
            </div>
          </div>
        ) : (
          data.transfers.map((t) => (
            <div key={`${t.fromUserId}-${t.toUserId}`} className="grid gap-4">
              <div className="flex items-center gap-3 sm:gap-5">
                <Avatar
                  name={nameOf.get(t.fromUserId) ?? "?"}
                  color={colorOf.get(t.fromUserId)!}
                  size="lg"
                />
                <div className="grid min-w-0 flex-1 justify-items-center gap-1">
                  <span className="text-2xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                    {money(t.amount)}
                  </span>
                  <span className="flex w-full items-center gap-1 text-(--muted-foreground)">
                    <span className="h-px flex-1 bg-current opacity-40" />
                    <ArrowRight className="size-4" aria-hidden />
                  </span>
                </div>
                <Avatar
                  name={nameOf.get(t.toUserId) ?? "?"}
                  color={colorOf.get(t.toUserId)!}
                  size="lg"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-medium">
                  {you(t.fromUserId)
                    ? `Devi dare ${money(t.amount)} a ${nameOf.get(t.toUserId)}`
                    : you(t.toUserId)
                      ? `${nameOf.get(t.fromUserId)} ti deve ${money(t.amount)}`
                      : `${nameOf.get(t.fromUserId)} deve ${money(t.amount)} a ${nameOf.get(t.toUserId)}`}
                </p>
                <Button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await run(
                        recordSettlement({
                          fromUserId: t.fromUserId,
                          toUserId: t.toUserId,
                          amount: t.amount,
                        }),
                        "Fatto: conti pareggiati",
                      );
                    })
                  }
                >
                  <Handshake />
                  Segna come saldato
                </Button>
              </div>
            </div>
          ))
        )}
        {data.unattributed > 0 && (
          <p className="text-muted-foreground text-xs">
            {money(data.unattributed)} di spese registrate da chi ha lasciato lo spazio non sono
            attribuite a nessuno.
          </p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section
          className="bg-card grid content-start gap-4 rounded-xl border p-4"
          aria-labelledby="who-title"
        >
          <h2 id="who-title" className="font-medium">
            Chi ha pagato cosa
          </h2>
          {data.members.map((m) => {
            const scale = Math.max(...data.members.map((x) => Math.max(x.paid, x.fairShare)), 1);
            return (
              <div key={m.userId} className="grid gap-2">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} color={colorOf.get(m.userId)!} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {m.name}
                      {you(m.userId) && (
                        <span className="text-muted-foreground font-normal"> (tu)</span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      Ha pagato {money(m.paid)} · la sua parte {money(m.fairShare)} (
                      {Math.round(m.share * 100)}%)
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      m.balance > 0.004
                        ? "text-(--delta-good)"
                        : m.balance < -0.004
                          ? "text-(--delta-bad)"
                          : "text-muted-foreground",
                    )}
                  >
                    {m.balance > 0.004 ? "+" : ""}
                    {money(m.balance)}
                  </span>
                </div>
                <div className="bg-muted relative h-2 rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(m.paid / scale) * 100}%`,
                      background: colorOf.get(m.userId),
                    }}
                  />
                  <div
                    aria-hidden
                    title="La sua parte"
                    className="bg-foreground absolute -top-1 h-4 w-0.5 rounded-full"
                    style={{ left: `${(m.fairShare / scale) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-muted-foreground text-xs">
            La tacca nera indica la parte che spetta a ciascuno.
          </p>
        </section>

        <section
          className="bg-card grid content-start gap-4 rounded-xl border p-4"
          aria-labelledby="rules-title"
        >
          <div>
            <h2 id="rules-title" className="font-medium">
              Le vostre regole
            </h2>
            <p className="text-muted-foreground text-sm">
              Contano le spese di tutti, tranne quelle con il tag «personale».
            </p>
          </div>
          <div
            className="bg-muted inline-flex justify-self-start rounded-lg p-1 text-sm"
            role="group"
            aria-label="Come dividere"
          >
            {(
              [
                { value: "EQUAL", label: "Metà e metà" },
                { value: "INCOME", label: "In base alle entrate" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={mode === o.value}
                onClick={() => setMode(o.value)}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  mode === o.value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {mode === "EQUAL"
              ? "Ognuno copre la stessa quota delle spese comuni."
              : data.fallback
                ? "Per dividere in base alle entrate serve lo stipendio di tutti: ognuno lo imposta in Impostazioni › Il prezzo in ore di lavoro. Intanto dividete a metà."
                : `Chi guadagna di più contribuisce di più: ${data.members
                    .map((m) => `${m.name} ${Math.round(m.share * 100)}%`)
                    .join(", ")}.`}
          </p>
          <div className="grid gap-2">
            <Label htmlFor="split-since">Conta le spese dal</Label>
            <Input
              id="split-since"
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="max-w-48"
            />
          </div>
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={!settingsChanged || pending || !since}
            onClick={() =>
              startTransition(async () => {
                await run(updateSplitSettings({ mode, since }), "Regole aggiornate");
              })
            }
          >
            Salva le regole
          </Button>
        </section>
      </div>

      <section className="bg-card grid gap-3 rounded-xl border p-4" aria-labelledby="months-title">
        <h2 id="months-title" className="font-medium">
          Spese comuni mese per mese
        </h2>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.months} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis
                width={44}
                tickFormatter={(v: number) => (hidden ? "" : axisNumber.format(v))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                formatter={(value, name) => [
                  money(Number(value)),
                  nameOf.get(String(name)) ?? name,
                ]}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              {data.members.map((m, i) => (
                <Bar
                  key={m.userId}
                  dataKey={m.userId}
                  stackId="paid"
                  fill={colorOf.get(m.userId)}
                  radius={i === data.members.length - 1 ? [4, 4, 0, 0] : 0}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {data.members.map((m) => (
            <span key={m.userId} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: colorOf.get(m.userId) }}
              />
              {m.name}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-card grid gap-3 rounded-xl border p-4" aria-labelledby="recent-title">
        <div>
          <h2 id="recent-title" className="font-medium">
            Ultime spese
          </h2>
          <p className="text-muted-foreground text-sm">
            Segna come personale quello che non va diviso.
          </p>
        </div>
        {data.recent.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nessuna spesa dal {fmt(data.since, longDate)}.
          </p>
        ) : (
          <ul className="divide-y">
            {data.recent.map((r) => (
              <li
                key={r.id}
                className={cn("flex items-center gap-3 py-2", r.personal && "opacity-60")}
              >
                <CategoryIcon name={r.category?.icon} color={r.category?.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <UserRound className="size-3" aria-hidden /> {r.paidBy} · {fmt(r.date)}
                  </p>
                </div>
                <span className="text-sm tabular-nums">{money(r.amount)}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.personal}
                  aria-label={`Spesa personale: ${r.description}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await run(
                        setExpensePersonal(r.id, !r.personal),
                        r.personal ? "Di nuovo tra le spese comuni" : "Segnata come personale",
                      );
                    })
                  }
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors",
                    r.personal ? "bg-foreground text-background" : "hover:bg-muted",
                  )}
                >
                  {r.personal ? "Personale" : "Comune"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.settlements.length > 0 && (
        <section
          className="bg-card grid gap-3 rounded-xl border p-4"
          aria-labelledby="settled-title"
        >
          <h2 id="settled-title" className="font-medium">
            Pareggi registrati
          </h2>
          <ul className="divide-y">
            {data.settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <Handshake className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  {s.from} → {s.to}
                  <span className="text-muted-foreground">
                    {" "}
                    · {fmt(s.date)}
                    {!s.counted && " · prima del periodo"}
                  </span>
                </span>
                <span className="tabular-nums">{money(s.amount)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Elimina il pareggio del ${fmt(s.date)}`}
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await run(deleteSettlement(s.id), "Pareggio eliminato");
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
