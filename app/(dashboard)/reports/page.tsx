import { CalendarDays, CalendarRange, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState } from "@/components/empty-state";
import { requireSpace } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { currentMonth, formatMonthYear } from "@/lib/dates";

export const metadata = { title: "Report · FinTrack" };

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

async function getReportMonths(householdId: string) {
  const rows = await prisma.$queryRaw<{ month: Date }[]>`
    SELECT DISTINCT date_trunc('month', "date")::date AS month
    FROM "transactions"
    WHERE "household_id" = ${householdId} AND "type"::text IN ('INCOME', 'EXPENSE')
    ORDER BY 1 DESC`;
  return rows.map((r) => r.month);
}

function ReportCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card grid content-start gap-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function ReportsPage() {
  const space = await requireSpace();
  const months = await getReportMonths(space.id);
  const years = Array.from(new Set(months.map((m) => m.getUTCFullYear())));
  const { start } = currentMonth();
  // Default to the last complete month when there is one: it's the report people usually want.
  const defaultMonth = months.find((m) => m < start) ?? months[0];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
        <p className="text-muted-foreground text-sm">
          Un riepilogo in PDF da conservare, stampare o condividere con chi gestisce i conti con te.
        </p>
      </div>

      {months.length === 0 ? (
        <EmptyState
          illustration="chart"
          title="Ancora niente da riepilogare"
          description="Registra qualche entrata o uscita: il tuo primo report sarà pronto a fine mese."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ReportCard
            icon={CalendarDays}
            title="Report mensile"
            description="Entrate, uscite, categorie, budget e le spese più grandi del mese."
          >
            <form action="/api/reports" method="get" className="grid gap-3">
              <input type="hidden" name="period" value="month" />
              <div className="grid gap-1.5">
                <Label htmlFor="report-month">Mese</Label>
                <NativeSelect
                  id="report-month"
                  name="month"
                  defaultValue={monthKey(defaultMonth)}
                  className="w-full"
                >
                  {months.map((m) => (
                    <NativeSelectOption key={monthKey(m)} value={monthKey(m)}>
                      {formatMonthYear(m)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" className="justify-self-start">
                <Download aria-hidden /> Scarica PDF
              </Button>
            </form>
          </ReportCard>

          <ReportCard
            icon={CalendarRange}
            title="Report annuale"
            description="L'anno mese per mese, con il totale per categoria e il tasso di risparmio."
          >
            <form action="/api/reports" method="get" className="grid gap-3">
              <input type="hidden" name="period" value="year" />
              <div className="grid gap-1.5">
                <Label htmlFor="report-year">Anno</Label>
                <NativeSelect
                  id="report-year"
                  name="year"
                  defaultValue={String(years[0])}
                  className="w-full"
                >
                  {years.map((y) => (
                    <NativeSelectOption key={y} value={y}>
                      {y}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <Button type="submit" className="justify-self-start">
                <Download aria-hidden /> Scarica PDF
              </Button>
            </form>
          </ReportCard>
        </div>
      )}
    </div>
  );
}
