import type { Tone } from "@/lib/finance/crash-test";

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 90;

const GRADIENTS: Record<Tone, [string, string, string]> = {
  ok: ["#064e3b", "#047857", "#0e7490"],
  warn: ["#78350f", "#b45309", "#c2410c"],
  danger: ["#7f1d1d", "#b91c1c", "#9d174d"],
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The crash test result as an image to share: the scenario and how long it holds, never an
 * amount. Drawn in the browser.
 */
export async function renderCrashCard(card: {
  scenario: string;
  verdict: string;
  detail: string;
  tone: Tone;
}) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  const [a, b, c] = GRADIENTS[card.tone];
  const gradient = ctx.createLinearGradient(0, 0, WIDTH * 0.6, HEIGHT);
  gradient.addColorStop(0, a);
  gradient.addColorStop(0.55, b);
  gradient.addColorStop(1, c);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, 700);
  glow.addColorStop(0, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "white";
  ctx.globalAlpha = 0.8;
  ctx.font = font(600, 40);
  ctx.fillText("Il mio crash test", PAD, 170);

  ctx.globalAlpha = 1;
  ctx.font = font(700, 64);
  let y = 300;
  for (const line of wrap(ctx, card.scenario, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 76;
  }

  ctx.font = font(800, 170);
  y += 140;
  for (const line of wrap(ctx, card.verdict, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 180;
  }

  ctx.globalAlpha = 0.88;
  ctx.font = font(500, 44);
  y += 10;
  for (const line of wrap(ctx, card.detail, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 58;
  }

  ctx.globalAlpha = 0.8;
  ctx.font = font(600, 32);
  ctx.fillText("FinTrack", PAD, HEIGHT - 80);
  ctx.textAlign = "right";
  ctx.fillText("Fai anche tu il crash test", WIDTH - PAD, HEIGHT - 80);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
