import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RawParams = Record<string, string | string[] | undefined>;

function pageHref(params: RawParams, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "page" && typeof value === "string" && value) search.set(key, value);
  }
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}

export function Pagination({
  params,
  page,
  pageCount,
}: {
  params: RawParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  const linkClass = (disabled: boolean) =>
    cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      disabled && "pointer-events-none opacity-50",
    );

  return (
    <nav aria-label="Paginazione" className="flex items-center justify-between gap-2">
      <Link
        href={pageHref(params, page - 1)}
        className={linkClass(page <= 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
      >
        <ChevronLeft data-icon="inline-start" />
        Precedente
      </Link>
      <span className="text-muted-foreground text-sm tabular-nums">
        Pagina {page} di {pageCount}
      </span>
      <Link
        href={pageHref(params, page + 1)}
        className={linkClass(page >= pageCount)}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
      >
        Successiva
        <ChevronRight data-icon="inline-end" />
      </Link>
    </nav>
  );
}
