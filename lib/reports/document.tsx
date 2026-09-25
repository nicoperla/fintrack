import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/reports/data";
import { formatCurrency, formatDate } from "@/lib/format";

// Colors mirror the light theme tokens (--viz-income, --viz-expense, --delta-*).
const C = {
  ink: "#171717",
  muted: "#737373",
  line: "#e5e5e5",
  soft: "#f5f5f5",
  income: "#2a78d6",
  expense: "#eb6834",
  good: "#16a34a",
  bad: "#dc2626",
  warn: "#b45309",
  other: "#a3a3a3",
};

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  brand: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  brandDot: { color: C.income },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 14 },
  subtitle: { color: C.muted, marginTop: 3 },
  section: { marginTop: 22 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  kpis: { flexDirection: "row", gap: 8, marginTop: 18 },
  kpi: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: C.soft },
  kpiLabel: { color: C.muted, fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 4 },
  kpiNote: { fontSize: 8, color: C.muted, marginTop: 3 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  headRow: { borderBottomColor: C.ink, paddingVertical: 4 },
  th: { color: C.muted, fontSize: 8, textTransform: "uppercase" },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: C.muted },
  barTrack: { height: 6, backgroundColor: C.soft, borderRadius: 3, flex: 1 },
  bar: { height: 6, borderRadius: 3 },
  swatch: { width: 7, height: 7, borderRadius: 2, marginRight: 6 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.muted,
  },
  empty: { color: C.muted, padding: 12, backgroundColor: C.soft, borderRadius: 6 },
});

const eur = (n: number) => formatCurrency(n).replace(/\u202f/g, " ");
const pct = (n: number) => (n > 0 && n < 0.005 ? "<1%" : `${Math.round(n * 100)}%`);

function delta(current: number, previous: number, goodWhenUp: boolean) {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  const up = change >= 0;
  return {
    // The built-in PDF fonts only cover WinAnsi: use a plain hyphen, not U+2212.
    text: `${up ? "+" : "-"}${Math.abs(Math.round(change * 100))}%`,
    color: Math.abs(change) < 0.005 ? C.muted : up === goodWhenUp ? C.good : C.bad,
  };
}

function Kpi({
  label,
  value,
  color,
  note,
}: {
  label: string;
  value: string;
  color?: string;
  note?: { text: string; color?: string } | string | null;
}) {
  const n = typeof note === "string" ? { text: note } : note;
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : {}]}>{value}</Text>
      {n && <Text style={[s.kpiNote, n.color ? { color: n.color } : {}]}>{n.text}</Text>}
    </View>
  );
}

function CategoryTable({
  slices,
  color,
  total,
}: {
  slices: ReportData["expenseCategories"];
  color: string;
  total: number;
}) {
  const max = Math.max(...slices.map((x) => x.value), 1);
  return (
    <View>
      {slices.map((slice) => (
        <View key={slice.name} style={s.row} wrap={false}>
          <View style={[s.swatch, { backgroundColor: slice.color ?? C.other }]} />
          <Text style={{ width: 130 }}>{slice.name}</Text>
          <View style={s.barTrack}>
            <View
              style={[s.bar, { width: `${(slice.value / max) * 100}%`, backgroundColor: color }]}
            />
          </View>
          <Text style={[s.small, s.right, { width: 40 }]}>{pct(slice.share)}</Text>
          <Text style={[s.right, { width: 80 }]}>{eur(slice.value)}</Text>
        </View>
      ))}
      <View style={[s.row, { borderBottomWidth: 0 }]}>
        <Text style={[s.bold, { flex: 1 }]}>Totale</Text>
        <Text style={[s.bold, s.right, { width: 80 }]}>{eur(total)}</Text>
      </View>
    </View>
  );
}

export function ReportDocument({ data }: { data: ReportData }) {
  const generated = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(data.generatedAt);
  const netWorth = data.accounts.reduce((sum, a) => sum + a.balance, 0);
  const maxMonth = Math.max(...data.months.map((m) => Math.max(m.income, m.expense)), 1);
  const expenseDelta = delta(data.expense, data.previous.expense, false);
  const incomeDelta = delta(data.income, data.previous.income, true);

  return (
    <Document title={`FinTrack · ${data.title} · ${data.label}`} author="FinTrack" language="it-IT">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>
            FinTrack<Text style={s.brandDot}>.</Text>
          </Text>
          <Text style={s.small}>{data.owner}</Text>
        </View>
        <Text style={s.title}>
          {data.title} · {data.label}
        </Text>
        <Text style={s.subtitle}>
          {data.count === 0
            ? "Nessun movimento registrato nel periodo."
            : `${data.count} ${data.count === 1 ? "movimento" : "movimenti"} tra entrate e uscite (esclusi i trasferimenti tra conti).`}
        </Text>

        <View style={s.kpis}>
          <Kpi
            label="Entrate"
            value={eur(data.income)}
            color={C.income}
            note={
              incomeDelta && {
                ...incomeDelta,
                text: `${incomeDelta.text} vs ${data.previousLabel}`,
              }
            }
          />
          <Kpi
            label="Uscite"
            value={eur(data.expense)}
            color={C.expense}
            note={
              expenseDelta && {
                ...expenseDelta,
                text: `${expenseDelta.text} vs ${data.previousLabel}`,
              }
            }
          />
          <Kpi
            label="Risparmio netto"
            value={eur(data.net)}
            color={data.net >= 0 ? C.good : C.bad}
            note={data.savingsRate !== null ? `Tasso di risparmio ${pct(data.savingsRate)}` : null}
          />
          <Kpi
            label="Patrimonio oggi"
            value={eur(netWorth)}
            note={`${data.accounts.length} conti`}
          />
        </View>

        {data.kind === "year" && (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Mese per mese</Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, gap: 6 }}>
              {data.months.map((m) => (
                <View key={m.label} style={{ flex: 1, alignItems: "center" }}>
                  <View
                    style={{ flexDirection: "row", alignItems: "flex-end", gap: 1.5, height: 76 }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: (m.income / maxMonth) * 76,
                        backgroundColor: C.income,
                        borderRadius: 1.5,
                      }}
                    />
                    <View
                      style={{
                        width: 7,
                        height: (m.expense / maxMonth) * 76,
                        backgroundColor: C.expense,
                        borderRadius: 1.5,
                      }}
                    />
                  </View>
                  <Text style={[s.small, { marginTop: 3 }]}>{m.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
              <View style={[s.swatch, { backgroundColor: C.income }]} />
              <Text style={[s.small, { marginRight: 10 }]}>Entrate</Text>
              <View style={[s.swatch, { backgroundColor: C.expense }]} />
              <Text style={s.small}>Uscite</Text>
            </View>
            <View style={{ marginTop: 10 }}>
              <View style={[s.row, s.headRow]}>
                <Text style={[s.th, { flex: 1 }]}>Mese</Text>
                <Text style={[s.th, s.right, { width: 90 }]}>Entrate</Text>
                <Text style={[s.th, s.right, { width: 90 }]}>Uscite</Text>
                <Text style={[s.th, s.right, { width: 90 }]}>Netto</Text>
              </View>
              {data.months.map((m) => (
                <View key={m.label} style={s.row}>
                  <Text style={{ flex: 1 }}>{m.label}</Text>
                  {m.hasData ? (
                    <>
                      <Text style={[s.right, { width: 90 }]}>{eur(m.income)}</Text>
                      <Text style={[s.right, { width: 90 }]}>{eur(m.expense)}</Text>
                      <Text style={[s.right, { width: 90, color: m.net >= 0 ? C.good : C.bad }]}>
                        {eur(m.net)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[s.small, s.right, { width: 270 }]}>Nessun movimento</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={s.section}>
          <Text style={s.h2}>Dove sono andati i soldi</Text>
          {data.expenseCategories.length ? (
            <CategoryTable slices={data.expenseCategories} color={C.expense} total={data.expense} />
          ) : (
            <Text style={s.empty}>Nessuna uscita nel periodo.</Text>
          )}
        </View>

        {data.incomeCategories.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Da dove sono arrivati</Text>
            <CategoryTable slices={data.incomeCategories} color={C.income} total={data.income} />
          </View>
        )}

        {data.budgets.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Budget del mese</Text>
            <View style={[s.row, s.headRow]}>
              <Text style={[s.th, { flex: 1 }]}>Categoria</Text>
              <Text style={[s.th, s.right, { width: 80 }]}>Speso</Text>
              <Text style={[s.th, s.right, { width: 80 }]}>Budget</Text>
              <Text style={[s.th, s.right, { width: 90 }]}>Esito</Text>
            </View>
            {data.budgets.map((b) => (
              <View key={b.name} style={s.row}>
                <Text style={{ flex: 1 }}>{b.name}</Text>
                <Text style={[s.right, { width: 80 }]}>{eur(b.spent)}</Text>
                <Text style={[s.right, { width: 80 }]}>{eur(b.amount)}</Text>
                <Text
                  style={[
                    s.right,
                    {
                      width: 90,
                      color: b.status === "over" ? C.bad : b.status === "warning" ? C.warn : C.good,
                    },
                  ]}
                >
                  {b.status === "over"
                    ? `Sforato di ${eur(-b.remaining)}`
                    : `${pct(b.ratio)} usato`}
                </Text>
              </View>
            ))}
          </View>
        )}

        {data.biggest.length > 0 && (
          <View style={s.section} wrap={false}>
            <Text style={s.h2}>Le spese più grandi</Text>
            <View style={[s.row, s.headRow]}>
              <Text style={[s.th, { width: 70 }]}>Data</Text>
              <Text style={[s.th, { flex: 1 }]}>Descrizione</Text>
              <Text style={[s.th, { width: 110 }]}>Categoria</Text>
              <Text style={[s.th, s.right, { width: 80 }]}>Importo</Text>
            </View>
            {data.biggest.map((t, i) => (
              <View key={i} style={s.row}>
                <Text style={[s.small, { width: 70 }]}>{formatDate(t.date)}</Text>
                <Text style={{ flex: 1 }}>{t.description}</Text>
                <Text style={[s.small, { width: 110 }]}>{t.category}</Text>
                <Text style={[s.right, { width: 80 }]}>{eur(t.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>Conti (saldo attuale)</Text>
          {data.accounts.map((a) => (
            <View key={a.name} style={s.row}>
              <Text style={{ flex: 1 }}>{a.name}</Text>
              <Text style={[s.small, { width: 110 }]}>{a.type}</Text>
              <Text style={[s.right, { width: 90, color: a.balance < 0 ? C.bad : C.ink }]}>
                {eur(a.balance)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>Generato da FinTrack il {generated}</Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
