import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/format";
import type { FamilyFileContent } from "@/lib/family-file";

/* "Il fascicolo di famiglia" on paper: the same content as the shared page, to print and keep. */

const s = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingHorizontal: 48,
    paddingBottom: 64,
    fontSize: 10,
    lineHeight: 1.45,
    color: "#171717",
    fontFamily: "Helvetica",
  },
  kicker: { fontSize: 8, color: "#737373", textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2 },
  muted: { color: "#737373" },
  section: { marginTop: 18 },
  heading: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  note: { padding: 8, backgroundColor: "#f5f5f5", borderRadius: 4, marginTop: 4 },
  footer: { marginTop: 24, fontSize: 8, color: "#a3a3a3" },
});

// The built-in PDF fonts lack the narrow no-break space Intl puts in some amounts.
const printable = (text: string) => text.replace(/[  ]/g, " ");
const longDate = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const day = (iso: string) => longDate.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

function Row({ main, sub, value }: { main: string; sub?: string; value?: string | null }) {
  return (
    <View style={s.row} wrap={false}>
      <View style={{ flexShrink: 1, paddingRight: 8 }}>
        <Text>{printable(main)}</Text>
        {sub ? <Text style={s.muted}>{printable(sub)}</Text> : null}
      </View>
      {value ? <Text>{printable(value)}</Text> : null}
    </View>
  );
}

export function FamilyFilePdf({ content }: { content: FamilyFileContent }) {
  const money = (n: number | null, currency = content.currency) =>
    n === null ? null : formatCurrency(n, currency);
  return (
    <Document title={`Fascicolo di famiglia · ${content.spaceName}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.kicker}>Il fascicolo di famiglia</Text>
        <Text style={s.title}>{printable(content.spaceName)}</Text>
        <Text style={s.muted}>
          Aggiornato al {day(content.generatedOn)}
          {content.people.length > 0 ? ` · ${content.people.join(", ")}` : ""}
          {content.showAmounts ? "" : " · senza importi"}
        </Text>

        {content.accounts.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>I conti</Text>
            {content.accounts.map((a, i) => (
              <Row
                key={i}
                main={a.name}
                sub={[
                  // "Contanti" called "Contanti": no need to say it twice.
                  a.kind.toLowerCase() !== a.name.toLowerCase() ? a.kind : null,
                  a.currency !== content.currency ? a.currency : null,
                  a.archived ? "non più usato" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={money(a.balance, a.currency)}
              />
            ))}
          </View>
        )}

        {content.investments.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Gli investimenti</Text>
            {content.investments.map((inv, i) => (
              <Row
                key={i}
                main={inv.name}
                sub={
                  inv.valuedAt
                    ? `Valore aggiornato al ${day(inv.valuedAt)}`
                    : "Valore non ancora inserito"
                }
                value={money(inv.value, inv.currency)}
              />
            ))}
          </View>
        )}

        {content.debts.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>I debiti</Text>
            {content.debts.map((d, i) => (
              <Row
                key={i}
                main={d.name}
                sub={[
                  `Tasso ${d.interestRate.toLocaleString("it-IT")}%`,
                  d.minimumPayment !== null ? `rata ${money(d.minimumPayment)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                value={money(d.balance)}
              />
            ))}
          </View>
        )}

        {content.recurring.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Addebiti che continuano ad arrivare</Text>
            <Text style={s.muted}>Da disdire o da intestare a qualcun altro.</Text>
            {content.recurring.map((r, i) => (
              <Row key={i} main={r.name} sub={r.frequency} value={money(r.amount)} />
            ))}
          </View>
        )}

        {content.notes.map((n) => (
          <View key={n.title} style={s.section} wrap={false}>
            <Text style={s.heading}>{n.title}</Text>
            <Text style={s.note}>{printable(n.text)}</Text>
          </View>
        ))}

        <Text style={s.footer}>
          Non è un testamento e non contiene password: è una mappa, per sapere dove cercare e chi
          chiamare. Preparato con FinTrack.
        </Text>
      </Page>
    </Document>
  );
}
