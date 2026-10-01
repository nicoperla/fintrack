import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProPrice } from "@/lib/billing/stripe";
import { formatCurrency } from "@/lib/format";
import { Landing } from "@/components/marketing/landing";

export const metadata: Metadata = {
  title: "FinTrack · I tuoi soldi, finalmente chiari",
  description:
    "L'app italiana per le finanze personali: spese in tre secondi anche a voce, il prezzo in ore di lavoro, la previsione del saldo e un coach che segue le tue regole. Gratis.",
};

type SearchParams = { account?: string | string[] };

/** Signed in: straight to the dashboard. Otherwise, the landing page. */
export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  if (await getSession()) redirect("/dashboard");
  const price = await getProPrice();
  return (
    <Landing
      deleted={searchParams.account === "eliminato"}
      priceLabel={
        price
          ? `${formatCurrency(price.amount, price.currency)} / ${price.interval === "year" ? "anno" : "mese"}`
          : null
      }
    />
  );
}
