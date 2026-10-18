import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  DEDUCTION_TYPES,
  RULES,
  RULES_CHECKED_AT,
  type DeductionLine,
  type DeductionsSummary,
} from "@/lib/finance/deductions";
import { formatCurrency } from "@/lib/format";

/*
 * The 730 dossier: the year's deductible expenses grouped by type, with what counts, what was
 * lost to cash, what to confirm, which documents to keep and where each goes in the 730. With a
 * `guide` it becomes the "Il mio 730" reminder: the next step, the traffic light, the dates and
 * the documents checklist. Always a personal reminder, never a document for the CAF or the
 * Agenzia: those want the originals.
 */

const C = {
  ink: "#171717",
  muted: "#737373",
  line: "#e5e5e5",
  soft: "#f5f5f5",
  green: "#047857",
  warn: "#b45309",
  blue: "#0369a1",
};

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 9.5, color: C.ink, fontFamily: "Helvetica" },
  brand: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.green },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 12 },
  subtitle: { color: C.muted, marginTop: 3 },
  kpis: { flexDirection: "row", gap: 8, marginTop: 16 },
  kpi: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: C.soft },
  kpiLabel: { color: C.muted, fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4 },
  section: { marginTop: 20 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  rule: { color: C.muted, fontSize: 8, marginTop: 2, marginBottom: 6 },
  row: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  head: { borderBottomColor: C.ink },
  th: { color: C.muted, fontSize: 7.5, textTransform: "uppercase" },
  cDate: { width: 52 },
  cDesc: { flex: 1, paddingRight: 6 },
  cPay: { width: 90 },
  cAmount: { width: 62, textAlign: "right" },
  cStatus: { width: 78, textAlign: "right" },
  total: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  docs: { marginTop: 6, padding: 8, borderRadius: 4, backgroundColor: C.soft, fontSize: 8 },
  note: { fontSize: 8, color: C.muted, marginTop: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: C.muted,
  },
});

// The built-in PDF fonts lack U+202F, which Intl puts before some currency symbols.
const money = (n: number) => formatCurrency(n, "EUR").replace(/ /g, " ");
const date = (iso: string) => iso.split("-").reverse().join("/");

const STATUS: Record<DeductionLine["status"], { text: string; color: string }> = {
  ok: { text: "Detraibile", color: C.green },
  cash: { text: "Contanti: no", color: C.warn },
  check: { text: "Da verificare", color: C.blue },
  excluded: { text: "Esclusa", color: C.muted },
};

function Table({ lines }: { lines: DeductionLine[] }) {
  return (
    <View>
      <View style={[s.row, s.head]}>
        <Text style={[s.th, s.cDate]}>Data</Text>
        <Text style={[s.th, s.cDesc]}>Descrizione</Text>
        <Text style={[s.th, s.cPay]}>Pagamento</Text>
        <Text style={[s.th, s.cAmount]}>Importo</Text>
        <Text style={[s.th, s.cStatus]}>Stato</Text>
      </View>
      {lines.map((l) => (
        <View key={l.id} style={s.row} wrap={false}>
          <Text style={s.cDate}>{date(l.date)}</Text>
          <Text style={s.cDesc}>{l.description}</Text>
          <Text style={s.cPay}>{l.accountType === "CASH" ? "Contanti" : l.account}</Text>
          <Text style={s.cAmount}>{money(l.amount)}</Text>
          <Text style={[s.cStatus, { color: STATUS[l.status].color }]}>
            {STATUS[l.status].text}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** "Il mio 730": what the reminder adds to the dossier. */
export type DossierGuide = {
  next: { title: string; text: string; due?: string };
  light: { title: string; reasons: string[] } | null;
  dates: { label: string; date: string }[];
  documents: { label: string; detail: string; state: "have" | "todo" | "skip"; cafOnly: boolean }[];
  /** The marginal IRPEF rate deduzioni are worth. */
  marginal: number;
};

export type DossierData = {
  year: number;
  /** "Anna Rossi", or "Spazio «Casa» (tutte le persone)". */
  holder: string;
  generatedOn: string;
  summary: DeductionsSummary;
  children: number;
  guide?: DossierGuide;
};

const whereText = (type: keyof typeof RULES) => {
  const w = RULES[type].where;
  return w.code ? `quadro E, rigo ${w.line}, codice ${w.code}` : `quadro E, rigo ${w.line}`;
};

const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

export function DossierDocument({ data }: { data: DossierData }) {
  const { summary, guide } = data;
  const lines = summary.lines.filter((l) => l.status !== "excluded");
  const toCheck = lines.filter((l) => l.status === "check");
  const valid = summary.byType.reduce((sum, t) => sum + t.eligible, 0);

  return (
    <Document
      title={guide ? `Il mio 730/${data.year + 1}` : `Dossier 730/${data.year + 1}`}
      author="Orbitly"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>
          {guide ? "Orbitly · Il mio 730 · promemoria personale" : "Orbitly · Soldi ritrovati"}
        </Text>
        <Text style={s.title}>
          {guide ? "Il mio 730" : "Dossier 730"}/{data.year + 1}
        </Text>
        <Text style={s.subtitle}>
          Spese detraibili del {data.year} · {data.holder} · generato il {data.generatedOn}
        </Text>

        <View style={s.kpis}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Rimborso stimato</Text>
            <Text style={[s.kpiValue, { color: C.green }]}>{money(summary.refund)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Spese detraibili</Text>
            <Text style={s.kpiValue}>{money(valid)}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Da verificare</Text>
            <Text style={s.kpiValue}>{toCheck.length}</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Persi in contanti</Text>
            <Text style={[s.kpiValue, { color: summary.lostToCash ? C.warn : C.ink }]}>
              {money(summary.lostToCash)}
            </Text>
          </View>
        </View>

        {guide && (
          <View style={s.section}>
            <Text style={s.h2}>Il prossimo passo</Text>
            <Text style={[s.bold, { marginTop: 4 }]}>
              {guide.next.title}
              {guide.next.due ? ` (entro il ${dayMonth(guide.next.due)})` : ""}
            </Text>
            <Text style={s.note}>{guide.next.text}</Text>
            {guide.light && (
              <View style={s.docs}>
                <Text style={s.bold}>{guide.light.title}</Text>
                {guide.light.reasons.map((r) => (
                  <Text key={r}>· {r}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {guide && guide.dates.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>Le date</Text>
            {guide.dates.map((d) => (
              <View key={d.label} style={s.row}>
                <Text style={s.cDesc}>{d.label}</Text>
                <Text style={{ width: 140, textAlign: "right" }}>{dayMonth(d.date)}</Text>
              </View>
            ))}
          </View>
        )}

        {guide && guide.documents.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>I documenti da preparare</Text>
            <Text style={s.rule}>
              Gli originali: questo promemoria serve a te per non dimenticare niente.
            </Text>
            {guide.documents.map((d) => (
              <View key={d.label} style={s.row} wrap={false}>
                <Text style={{ width: 22, color: d.state === "have" ? C.green : C.muted }}>
                  {d.state === "have" ? "[x]" : d.state === "skip" ? " - " : "[ ]"}
                </Text>
                <View style={s.cDesc}>
                  <Text style={s.bold}>
                    {d.label}
                    {d.cafOnly ? " (per il CAF)" : ""}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 8 }}>{d.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {DEDUCTION_TYPES.map((type) => {
          const ofType = lines.filter((l) => l.type === type && l.status !== "check");
          if (ofType.length === 0) return null;
          const rule = RULES[type];
          const totals = summary.byType.find((t) => t.type === type);
          const limits = [
            rule.kind === "deduzione"
              ? `Deduzione dal reddito (vale la tua aliquota IRPEF${guide ? `, ${Math.round(guide.marginal * 100)}%` : ""})`
              : `Detrazione del ${Math.round(rule.rate * 100)}%`,
            rule.franchigia ? `franchigia di ${money(rule.franchigia)}` : null,
            rule.cap
              ? `limite di ${money(rule.cap)}${rule.perChild ? ` per figlio (figli indicati: ${Math.max(1, data.children)})` : ""}`
              : null,
          ].filter(Boolean);
          return (
            <View key={type} style={s.section}>
              <Text style={s.h2}>{rule.label}</Text>
              <Text style={s.rule}>
                {limits.join(", ")}. Nel 730: {whereText(type)}.
              </Text>
              <Table lines={ofType} />
              {totals && (
                <View style={s.total}>
                  <Text>
                    Valide {money(totals.eligible)} · conteggiate {money(totals.base)}
                  </Text>
                  <Text style={s.bold}>Rimborso stimato {money(totals.refund)}</Text>
                </View>
              )}
              <Text style={s.docs}>Da conservare: {rule.documents}</Text>
              {rule.note && <Text style={s.note}>{rule.note}</Text>}
            </View>
          );
        })}

        {toCheck.length > 0 && (
          <View style={s.section}>
            <Text style={s.h2}>Da verificare</Text>
            <Text style={s.rule}>
              Potrebbero essere detraibili: confermale nell&apos;app o chiedi al CAF.
            </Text>
            <Table lines={toCheck} />
          </View>
        )}

        {lines.length === 0 && (
          <View style={s.section}>
            <Text style={s.note}>Nessuna spesa detraibile registrata nel {data.year}.</Text>
          </View>
        )}

        <Text style={s.footer} fixed>
          {guide
            ? `Promemoria personale creato da Orbitly, non è un documento fiscale e non sostituisce gli originali. Stime con le regole verificate a ${RULES_CHECKED_AT}, sulle spese registrate nell'app. Orbitly non compila e non invia la dichiarazione: verifica sul sito dell'Agenzia delle Entrate o con un CAF.`
            : `Stima calcolata da Orbitly con le regole in vigore a ${RULES_CHECKED_AT}, sulle spese registrate nell'app. Non considera i tetti per redditi oltre 75.000 euro né l'imposta effettivamente dovuta. Non è consulenza fiscale: verifica col CAF o il commercialista e conserva i documenti originali.`}
        </Text>
      </Page>
    </Document>
  );
}
