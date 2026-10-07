import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/*
 * A "Riprenditeli" letter on paper, to print, sign and send by raccomandata. Just the text the
 * user saved: the parts in square brackets are left for them to fill in by hand.
 */

const s = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingHorizontal: 64,
    paddingBottom: 72,
    fontSize: 11,
    lineHeight: 1.5,
    color: "#171717",
    fontFamily: "Helvetica",
  },
  sender: { marginBottom: 28 },
  muted: { color: "#737373" },
  subject: { fontFamily: "Helvetica-Bold", marginBottom: 18 },
  paragraph: { marginBottom: 10 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 64,
    right: 64,
    fontSize: 7.5,
    color: "#a3a3a3",
  },
});

// The built-in PDF fonts lack the narrow no-break space Intl puts in some amounts.
const printable = (text: string) => text.replace(/[  ]/g, " ");

export type LetterPdfData = { subject: string; body: string; sender: string };

export function LetterDocument({ data }: { data: LetterPdfData }) {
  const paragraphs = printable(data.body).split(/\n{2,}/);
  return (
    <Document title={printable(data.subject)} author={data.sender}>
      <Page size="A4" style={s.page}>
        <View style={s.sender}>
          <Text>{data.sender}</Text>
          <Text style={s.muted}>[Indirizzo]</Text>
        </View>
        <Text style={s.subject}>Oggetto: {printable(data.subject)}</Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={s.paragraph}>
            {p}
          </Text>
        ))}
        <Text style={s.footer} fixed>
          Lettera preparata con FinTrack. Completa i dati tra parentesi quadre e firmala prima di
          spedirla. È un modello, non una consulenza legale.
        </Text>
      </Page>
    </Document>
  );
}
