const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 90;

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
 * How a pact went, as an image to share: the category, kept or not, and the percentage of the
 * limit used. Never an amount. Drawn in the browser.
 */
export async function renderPactCard(card: {
  won: boolean;
  category: string;
  month: string;
  used: number;
}) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  const stops = card.won ? ["#1e3a8a", "#4338ca", "#0e7490"] : ["#7c2d12", "#be123c", "#7e22ce"];
  const gradient = ctx.createLinearGradient(0, 0, WIDTH * 0.6, HEIGHT);
  stops.forEach((c, i) => gradient.addColorStop(i / 2, c));
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
  ctx.fillText(`Il mio patto di ${card.month}`, PAD, 170);

  ctx.globalAlpha = 1;
  ctx.font = font(800, 150);
  let y = 380;
  for (const line of wrap(ctx, card.won ? "Patto rispettato" : "Patto perso", WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 160;
  }

  ctx.globalAlpha = 0.9;
  ctx.font = font(600, 54);
  y += 30;
  for (const line of wrap(ctx, `«${card.category}»`, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 66;
  }

  // The limit as a bar: how much of it went, never how much that was.
  const barY = y + 60;
  const barW = WIDTH - PAD * 2;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(PAD, barY, barW, 36);
  ctx.globalAlpha = 1;
  ctx.fillRect(PAD, barY, barW * Math.min(1, card.used), 36);
  ctx.globalAlpha = 0.9;
  ctx.font = font(500, 44);
  ctx.fillText(`${Math.round(card.used * 100)}% del limite che mi ero dato`, PAD, barY + 110);

  ctx.globalAlpha = 0.85;
  ctx.font = font(500, 40);
  const tail = card.won
    ? "Una scommessa con me stesso, vinta."
    : "Ho pagato pegno. Il prossimo lo vinco.";
  ctx.fillText(tail, PAD, HEIGHT - 190);

  ctx.globalAlpha = 0.8;
  ctx.font = font(600, 32);
  ctx.fillText("FinTrack", PAD, HEIGHT - 80);
  ctx.textAlign = "right";
  ctx.fillText("Il patto", WIDTH - PAD, HEIGHT - 80);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
