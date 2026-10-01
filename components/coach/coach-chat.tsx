"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUp, Lock, MailCheck, ShieldCheck, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { maskAmounts } from "@/components/amount";
import {
  useAmountsHidden,
  useMoney,
  useSpaceInfo,
  useWholeMoney,
} from "@/components/currency-provider";
import { answerLocally } from "@/lib/finance/coach-answers";
import { checkAffordability } from "@/lib/finance/affordability";
import type { CoachInput, CoachReport } from "@/lib/finance/coach";
import type { AffordData } from "@/components/coach/afford-card";
import { cn } from "@/lib/utils";
import { setAiConsent } from "@/app/(dashboard)/coach/actions";

/** Whether the AI answers, and if not why (see lib/coach/access.ts). */
export type ChatAccess = {
  status: "off" | "pro" | "verify" | "consent" | "ready";
  /** Who receives the data, e.g. "Groq (Stati Uniti)". */
  providerName: string | null;
};

type Message = { role: "user" | "assistant"; content: string; local?: boolean };

const SUGGESTIONS = [
  "Come sto andando?",
  "Dove posso risparmiare?",
  "Posso permettermi un weekend da 300 €?",
  "Fammi un piano per il prossimo mese",
  "Quanto spendo in sigarette?",
];

/** **bold** and *italic* inside a line. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
      <em key={i} className="text-muted-foreground">
        {part.slice(1, -1)}
      </em>
    ) : (
      part
    ),
  );
}

/** The small subset of Markdown the coach writes: paragraphs, "- " lists and bold. */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="grid gap-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+\.)\s/.test(l))) {
          return (
            <ul key={i} className="grid list-disc gap-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function CoachChat({
  access,
  input,
  report,
  afford,
}: {
  access: ChatAccess;
  input: CoachInput;
  report: CoachReport;
  afford: AffordData;
}) {
  const money = useMoney();
  const whole = useWholeMoney();
  const hidden = useAmountsHidden();
  const { workRate } = useSpaceInfo();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(access.status);
  const [consenting, setConsenting] = useState(false);
  const ai = status === "ready";
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages]);

  const local = useCallback(
    (question: string) =>
      answerLocally(question, {
        input,
        report,
        money: whole,
        afford: (amount, monthly) =>
          afford.forecast
            ? checkAffordability(
                {
                  amount,
                  monthly,
                  points: afford.forecast.points,
                  events: afford.forecast.events,
                  dailySpend: afford.forecast.dailySpend,
                  savingsBalance: afford.savingsBalance,
                  monthlySaved: afford.monthlySaved,
                  goals: afford.goals,
                  budget: null,
                  workRate: hidden ? null : workRate,
                },
                money,
              )
            : null,
      }),
    [input, report, money, whole, afford, workRate, hidden],
  );

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history: Message[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setDraft("");

    const replyLocally = (note?: string) =>
      setMessages([
        ...history,
        {
          role: "assistant",
          content: note
            ? `*${note}*

${local(text)}`
            : local(text),
          local: true,
        },
      ]);

    if (!ai) {
      replyLocally();
      return;
    }

    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The last exchanges are enough context, and keep the request small.
          messages: history.slice(-12).map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const { code, error } = (await response.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
        };
        // The rules changed since the page loaded (plan, consent…): follow the server.
        if (code === "off" || code === "pro" || code === "verify" || code === "consent") {
          setStatus(code);
        }
        replyLocally(
          code === "busy"
            ? "Il coach AI è molto richiesto in questo momento: intanto ecco la risposta rapida."
            : code === "quota"
              ? `${error ?? "Hai finito le domande al coach AI per ora."} Intanto ecco la risposta rapida.`
              : undefined,
        );
        return;
      }
      if (!response.body) throw new Error("Risposta vuota");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      setMessages([...history, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      // Offline or AI unreachable: the built-in answers still work.
      replyLocally("Non riesco a raggiungere il coach AI: ecco la risposta rapida.");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function giveConsent() {
    setConsenting(true);
    const res = await setAiConsent(true).catch(() => null);
    setConsenting(false);
    if (res?.ok) {
      setStatus("ready");
      toast.success("Coach AI attivato");
    } else {
      toast.error("Non sono riuscito a salvare. Riprova.");
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="bg-card grid gap-4 rounded-2xl border p-5" aria-labelledby="chat-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="chat-title" className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" aria-hidden /> Chiedi al coach
          </h2>
          <p className="text-muted-foreground text-sm">
            {ai
              ? "Risponde con i tuoi numeri: medie, categorie, conti, obiettivi e movimenti recenti."
              : "Risposte rapide sui tuoi numeri. Con il coach AI attivo puoi chiedergli qualsiasi cosa."}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            ai ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {ai ? "AI" : "Risposte rapide"}
        </span>
      </div>

      {status === "consent" && (
        <div className="bg-muted/60 grid gap-3 rounded-xl border p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="size-4" aria-hidden /> Attiva il coach AI
          </p>
          <p className="text-muted-foreground">
            Per rispondere, il coach AI invia a {access.providerName ?? "un fornitore di AI"} un
            riepilogo dei tuoi dati: medie, categorie, conti, obiettivi, debiti e gli ultimi
            movimenti dello spazio. Il fornitore lo usa solo per generare la risposta. Puoi revocare
            il consenso quando vuoi dalle Impostazioni. Dettagli nella{" "}
            <Link href="/privacy#ai" className="text-foreground underline underline-offset-4">
              privacy
            </Link>
            .
          </p>
          <Button className="justify-self-start" onClick={giveConsent} disabled={consenting}>
            {consenting ? "Attivazione…" : "Accetto, attiva il coach AI"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Senza consenso puoi comunque usare le risposte rapide qui sotto.
          </p>
        </div>
      )}
      {status === "pro" && (
        <Link
          href="/settings#abbonamento"
          className="bg-muted/60 hover:bg-muted flex items-start gap-3 rounded-xl border p-4 text-sm transition-colors"
        >
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Il coach AI fa parte di FinTrack Pro.</span>{" "}
            <span className="text-muted-foreground">
              Risponde a qualsiasi domanda con i tuoi numeri. Intanto le risposte rapide qui sotto
              sono gratis.
            </span>
          </span>
        </Link>
      )}
      {status === "verify" && (
        <div className="bg-muted/60 flex items-start gap-3 rounded-xl border p-4 text-sm">
          <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium">Conferma la tua email per attivare il coach AI.</span>{" "}
            <span className="text-muted-foreground">
              Trovi il link nella posta; puoi farlo rinviare dal banner in alto.
            </span>
          </span>
        </div>
      )}

      {messages.length > 0 && (
        <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground justify-self-end rounded-br-md"
                  : "bg-muted justify-self-start rounded-bl-md",
              )}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <RichText text={hidden ? maskAmounts(m.content) : m.content} />
                ) : (
                  <span
                    className="text-muted-foreground inline-flex gap-1"
                    aria-label="Il coach sta scrivendo"
                  >
                    <span className="motion-safe:animate-bounce">·</span>
                    <span className="[animation-delay:120ms] motion-safe:animate-bounce">·</span>
                    <span className="[animation-delay:240ms] motion-safe:animate-bounce">·</span>
                  </span>
                )
              ) : (
                m.content
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.filter((s) => !messages.some((m) => m.content === s)).map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void ask(s)}
            className="hover:bg-muted rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(draft);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Scrivi una domanda sui tuoi soldi…"
          aria-label="Domanda per il coach"
          className="max-h-32 min-h-10 resize-none"
        />
        {busy ? (
          <Button
            type="button"
            size="icon-lg"
            variant="outline"
            aria-label="Interrompi"
            onClick={() => abortRef.current?.abort()}
          >
            <Square />
          </Button>
        ) : (
          <Button type="submit" size="icon-lg" aria-label="Invia" disabled={!draft.trim()}>
            <ArrowUp />
          </Button>
        )}
      </form>
    </section>
  );
}
