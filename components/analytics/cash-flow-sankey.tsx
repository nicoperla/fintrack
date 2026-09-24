"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Layer,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import type { FlowLink, FlowNode } from "@/lib/finance/analytics";
import { formatCurrency } from "@/lib/format";
import { inMonth } from "@/lib/finance/insights";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CashFlow = {
  label: string;
  month: string;
  previous: string | null;
  next: string | null;
  isCurrentMonth: boolean;
  nodes: FlowNode[];
  links: FlowLink[];
  totalIncome: number;
  totalExpense: number;
  net: number;
};

const NODE_WIDTH = 10;

function nodeColor(node: FlowNode) {
  if (node.kind === "hub") return "var(--muted-foreground)";
  if (node.kind === "savings") return "var(--viz-income)";
  if (node.kind === "deficit") return "var(--delta-bad)";
  return node.color ?? "var(--viz-other)";
}

type NodeRenderProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: FlowNode & { depth: number; value: number };
};

function FlowNodeShape({ x, y, width, height, payload }: NodeRenderProps) {
  const isHub = payload.kind === "hub";
  const isSource = payload.kind === "income" || payload.kind === "deficit";
  const textX = isHub ? x + width / 2 : isSource ? x - 8 : x + width + 8;
  const anchor = isHub ? "middle" : isSource ? "end" : "start";
  const textY = isHub ? y - 22 : y + height / 2 - 7;

  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(height, 2)}
        fill={nodeColor(payload)}
        radius={2}
      />
      <text
        x={textX}
        y={textY}
        textAnchor={anchor}
        className="fill-foreground text-[12px] font-medium"
      >
        {payload.name}
      </text>
      <text
        x={textX}
        y={textY + 15}
        textAnchor={anchor}
        className="fill-muted-foreground text-[11px]"
      >
        {formatCurrency(payload.value)}
      </text>
    </Layer>
  );
}

type LinkRenderProps = {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  payload: { source: FlowNode; target: FlowNode };
};

function FlowLinkShape(props: LinkRenderProps) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } =
    props;
  // Money keeps the colour of where it goes; income into the hub keeps its source colour.
  const colorNode = payload.target.kind === "hub" ? payload.source : payload.target;
  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={nodeColor(colorNode)}
      strokeWidth={Math.max(linkWidth, 1)}
      strokeOpacity={0.3}
      className="transition-[stroke-opacity] hover:[stroke-opacity:0.55]"
    />
  );
}

function FlowTooltip({ active, payload }: TooltipContentProps) {
  const item = payload?.[0]?.payload as
    { source?: FlowNode; target?: FlowNode; value: number; name?: string } | undefined;
  if (!active || !item) return null;
  const title =
    item.source && item.target ? `${item.source.name} → ${item.target.name}` : item.name;
  return (
    <div className="bg-popover text-popover-foreground ring-foreground/10 rounded-lg px-3 py-2 text-xs shadow-md ring-1">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground tabular-nums">{formatCurrency(item.value)}</p>
    </div>
  );
}

export function CashFlowSankey({
  flow,
  query,
}: {
  flow: CashFlow;
  /** Other search params of the page, kept when changing month. */
  query: Record<string, string>;
}) {
  const buildHref = (month: string) => `/insights?${new URLSearchParams({ ...query, month })}`;
  const rightCount = flow.nodes.filter((n) => n.kind === "expense" || n.kind === "savings").length;
  const height = Math.max(280, rightCount * 52);
  const empty = flow.links.length === 0;

  const nav = (month: string | null, label: string, Icon: typeof ChevronLeft) =>
    month ? (
      <Link
        href={buildHref(month)}
        scroll={false}
        aria-label={label}
        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
      >
        <Icon />
      </Link>
    ) : (
      <span
        aria-hidden
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "opacity-30")}
      >
        <Icon />
      </span>
    );

  return (
    <section
      className="bg-card flex flex-col gap-4 rounded-xl border p-4"
      aria-labelledby="flow-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="flow-title" className="font-medium">
            Flusso di cassa
          </h2>
          <p className="text-muted-foreground text-sm">Da dove arrivano i soldi e dove vanno</p>
        </div>
        <div className="flex items-center gap-1">
          {nav(flow.previous, "Mese precedente", ChevronLeft)}
          <span className="min-w-32 text-center text-sm font-medium">{flow.label}</span>
          {nav(flow.next, "Mese successivo", ChevronRight)}
        </div>
      </div>

      {empty ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Nessun movimento {inMonth(flow.label.toLowerCase())}.
        </p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="min-w-[640px]" style={{ height }}>
              <ResponsiveContainer width="100%" height="100%">
                <Sankey
                  data={{ nodes: flow.nodes, links: flow.links }}
                  nodeWidth={NODE_WIDTH}
                  nodePadding={28}
                  sort={false}
                  margin={{ top: 36, right: 150, bottom: 8, left: 150 }}
                  node={(props) => <FlowNodeShape {...(props as unknown as NodeRenderProps)} />}
                  link={(props) => <FlowLinkShape {...(props as unknown as LinkRenderProps)} />}
                >
                  <Tooltip content={FlowTooltip} isAnimationActive={false} />
                </Sankey>
              </ResponsiveContainer>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 border-t pt-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">Entrate</dt>
              <dd className="font-medium">{formatCurrency(flow.totalIncome)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Uscite</dt>
              <dd className="font-medium">{formatCurrency(flow.totalExpense)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">
                {flow.net >= 0 ? "Risparmiato" : "Speso oltre le entrate"}
              </dt>
              <dd className="font-medium">{formatCurrency(Math.abs(flow.net))}</dd>
            </div>
          </dl>
          {flow.isCurrentMonth && (
            <p className="text-muted-foreground -mt-2 text-xs">
              Il mese è ancora in corso: il flusso si completa man mano che registri i movimenti.
            </p>
          )}
        </>
      )}
    </section>
  );
}
