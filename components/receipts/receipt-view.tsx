"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AlertTriangle, Bot, Camera, Loader2, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useMoney } from "@/components/currency-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ProLock, TaxSection, TONE_BOX } from "@/components/tax/ui";
import { setAiConsent } from "@/app/(dashboard)/coach/actions";
import { saveReceipt } from "@/app/(dashboard)/transactions/scontrino/actions";
import {
  KIND_LABELS,
  RECEIPT_MAX_BYTES,
  defaultDeductible,
  splitReceipt,
  type Receipt as ReceiptData,
} from "@/lib/receipts/receipt";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type Status = "off" | "pro" | "verify" | "consent" | "ready";
type Option = { id: string; label: string };

const toText = (n: number) => n.toFixed(2).replace(".", ",");

export function ReceiptView({
  status,
  provider,
  today,
  accounts,
  categories,
  defaults,
}: {
  status: Status;
  provider: string | null;
  today: string;
  accounts: { id: string; name: string; type: string }[];
  categories: Option[];
  defaults: { health: string | null; other: string | null };
}) {
  const money = useMoney();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<Status>(status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [deductible, setDeductible] = useState<Set<number>>(new Set());
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today);
  const [merchant, setMerchant] = useState("");
  const [healthCategory, setHealthCategory] = useState(defaults.health ?? "");
  const [otherCategory, setOtherCategory] = useState(defaults.other ?? "");
  const [keepReceipt, setKeepReceipt] = useState(true);
  const [saving, setSaving] = useState(false);

  async function consent() {
    const res = await setAiConsent(true).catch(() => ({ ok: false }));
    if (res.ok) setState("ready");
    else toast.error("Non riuscito. Riprova.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > RECEIPT_MAX_BYTES) {
      setError("La foto è troppo grande: al massimo 5 MB.");
      return;
    }
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/scontrino", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.receipt) {
        if (json?.code === "consent") setState("consent");
        setError(json?.error ?? "Non riesco a leggerlo adesso. Riprova.");
        return;
      }
      const r = json.receipt as ReceiptData;
      setReceipt(r);
      setDeductible(defaultDeductible(r.items));
      setMerchant(r.merchant ?? "");
      setDate(r.date && r.date <= today ? r.date : today);
      // Cash on the receipt: the cash account; otherwise the first card or current account.
      const cash = accounts.find((a) => a.type === "CASH");
      const card = accounts.find((a) => a.type === "CARD" || a.type === "CHECKING");
      setAccountId((r.payment === "contanti" ? cash : card)?.id ?? accounts[0]?.id ?? "");
    } catch {
      setError("Connessione assente: riprova quando sei online.");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (!receipt) return;
    const split = splitReceipt(receipt.items, deductible);
    setSaving(true);
    const res = await saveReceipt({
      accountId,
      date,
      merchant: merchant.trim().slice(0, 60),
      fiscalCode: receipt.fiscalCode,
      keepReceipt,
      health:
        split.health.amount > 0
          ? { amount: toText(split.health.amount), categoryId: healthCategory || null }
          : null,
      other:
        split.other.amount > 0
          ? { amount: toText(split.other.amount), categoryId: otherCategory || null }
          : null,
    }).catch((): ActionResult => ({ ok: false, error: "Salvataggio non riuscito. Riprova." }));
    setSaving(false);
    if (!res.ok) {
      toast.error(
        res.error ?? Object.values(res.fieldErrors ?? {}).flat()[0] ?? "Controlla i dati.",
      );
      return;
    }
    toast.success("Scontrino salvato");
    res.warnings?.forEach((w) => toast(w));
    setReceipt(null);
  }

  const split = receipt ? splitReceipt(receipt.items, deductible) : null;
  const mismatch =
    receipt?.total !== null && receipt?.total !== undefined && split
      ? Math.abs(receipt.total - split.total) > 0.05
      : false;

  return (
    <div className="grid grid-cols-1 gap-6">
      <TaxSection
        id="scontrino"
        icon={Receipt}
        title="Lo scontrino"
        subtitle="Meglio dritto, intero e con buona luce. Funziona con farmacie, parafarmacie e negozi."
      >
        {state === "off" && (
          <p className="text-muted-foreground text-sm">
            La lettura degli scontrini non è attiva su questo server.
          </p>
        )}
        {state === "pro" && (
          <ProLock what="fotografi lo scontrino e separo da solo i farmaci detraibili dal resto" />
        )}
        {state === "verify" && (
          <p className="text-sm">
            Conferma la tua email per usarla: trovi il link nella posta che ti abbiamo mandato.
          </p>
        )}
        {state === "consent" && (
          <div className="grid gap-3 rounded-xl border p-4 text-sm">
            <p>
              Per leggerlo, la foto viene inviata al fornitore di intelligenza artificiale (
              {provider ?? "esterno"}): la usa solo per rispondere e Orbitly non la conserva. Uno
              scontrino della farmacia dice quali farmaci compri, cioè dati sulla salute: serve il
              tuo consenso (lo stesso del coach AI, puoi toglierlo dalle impostazioni).
            </p>
            <Button className="justify-self-start" onClick={() => void consent()}>
              Accetto, attiva la lettura
            </Button>
          </div>
        )}
        {state === "ready" && (
          <div className="grid gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="receipt-file"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            {accounts.length === 0 ? (
              <p className="text-sm">
                Prima serve un conto su cui registrare la spesa.{" "}
                <Link href="/accounts" className="font-medium underline-offset-2 hover:underline">
                  Vai ai conti
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? <Loader2 className="animate-spin" /> : <Camera />}
                  {loading
                    ? "Leggo lo scontrino…"
                    : receipt
                      ? "Leggi un altro scontrino"
                      : "Fotografa o carica lo scontrino"}
                </Button>
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="size-3.5" aria-hidden /> La foto non viene salvata, e
                  nemmeno i nomi dei prodotti: solo i totali.
                </p>
              </div>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}
      </TaxSection>

      {receipt && !receipt.readable && (
        <p className={cn("rounded-xl border p-4 text-sm", TONE_BOX.warn)}>
          Non riesco a leggere bene questo scontrino. Prova con una foto più vicina, dritta e con
          più luce.
        </p>
      )}

      {receipt && receipt.readable && split && (
        <TaxSection
          id="controllo"
          icon={Receipt}
          title="Controlla e salva"
          subtitle="Tocca una voce per spostarla tra detraibili e non detraibili."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Negozio</span>
              <Input
                value={merchant}
                maxLength={60}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Data</span>
              <Input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">Conto</span>
              <NativeSelect
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full"
              >
                {accounts.map((a) => (
                  <NativeSelectOption key={a.id} value={a.id}>
                    {a.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          </div>

          {split.health.count > 0 && !receipt.fiscalCode && (
            <p className={cn("flex gap-2 rounded-xl border p-3 text-sm", TONE_BOX.warn)}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              Su questo scontrino non vedo il codice fiscale: senza, i farmaci non si detraggono. La
              prossima volta dai la tessera sanitaria alla cassa. Li salvo lo stesso, segnati come
              non detraibili.
            </p>
          )}

          <ul className="divide-y text-sm">
            {receipt.items.map((item, i) => {
              const on = deductible.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setDeductible((prev) => {
                        const next = new Set(prev);
                        if (next.has(i)) next.delete(i);
                        else next.add(i);
                        return next;
                      })
                    }
                    className="hover:bg-muted/40 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left"
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                        on
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {on ? "730" : "no"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.description}</span>
                      <span className="text-muted-foreground block text-xs">
                        {KIND_LABELS[item.kind]}
                        {item.aic && " · codice AIC"}
                      </span>
                    </span>
                    <span className="tabular-nums">{money(item.amount)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            {split.health.amount > 0 && (
              <div className={cn("grid gap-2 rounded-xl border p-3 text-sm", TONE_BOX.good)}>
                <p className="font-medium">
                  Farmaci e dispositivi: {money(split.health.amount)}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {split.health.count === 1 ? "1 voce" : `${split.health.count} voci`}
                  </span>
                </p>
                <NativeSelect
                  value={healthCategory}
                  onChange={(e) => setHealthCategory(e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">Senza categoria</NativeSelectOption>
                  {categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {receipt.fiscalCode && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={keepReceipt}
                      onChange={(e) => setKeepReceipt(e.target.checked)}
                    />
                    Conservo lo scontrino (lo spunto nella cartellina del 730)
                  </label>
                )}
              </div>
            )}
            {split.other.amount > 0 && (
              <div className="grid gap-2 rounded-xl border p-3 text-sm">
                <p className="font-medium">
                  Il resto: {money(split.other.amount)}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {split.other.count === 1 ? "1 voce" : `${split.other.count} voci`}
                  </span>
                </p>
                <NativeSelect
                  value={otherCategory}
                  onChange={(e) => setOtherCategory(e.target.value)}
                  className="w-full"
                >
                  <NativeSelectOption value="">Senza categoria</NativeSelectOption>
                  {categories.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            )}
          </div>

          {mismatch && (
            <p className="text-muted-foreground text-xs">
              Le voci fanno {money(split.total)}, il totale dello scontrino è{" "}
              {money(receipt.total!)}: controlla che non manchi niente.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <Bot className="mt-0.5 size-3.5 shrink-0" aria-hidden /> Letto dall&apos;intelligenza
              artificiale: controlla le voci prima di salvare.
            </p>
            <div className="flex gap-2">
              <Link href="/730#cartellina" className={buttonVariants({ variant: "ghost" })}>
                Vai alla cartellina
              </Link>
              <Button
                onClick={() => void save()}
                disabled={saving || !accountId || split.total <= 0}
              >
                {saving
                  ? "Salvo…"
                  : split.health.amount > 0 && split.other.amount > 0
                    ? "Salva 2 movimenti"
                    : "Salva il movimento"}
              </Button>
            </div>
          </div>
        </TaxSection>
      )}
    </div>
  );
}
