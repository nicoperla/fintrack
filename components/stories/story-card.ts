import type { StoryData } from "@/lib/finance/stories";

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 80;

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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The shareable card of a month, drawn in the browser: profile, savings rate, no-spend days and
 * top category. No amounts, so it can be posted without giving away the user's finances.
 */
export async function renderStoryCard(story: StoryData, monthName: string, year: number) {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;

  const gradient = ctx.createLinearGradient(0, 0, WIDTH * 0.6, HEIGHT);
  gradient.addColorStop(0, "#4f46e5");
  gradient.addColorStop(0.55, "#7c3aed");
  gradient.addColorStop(1, "#db2777");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // A soft glow in the corner, like the in-app slides.
  const glow = ctx.createRadialGradient(WIDTH, 0, 0, WIDTH, 0, 700);
  glow.addColorStop(0, "rgba(255,255,255,0.25)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "white";
  ctx.textBaseline = "alphabetic";

  ctx.globalAlpha = 0.8;
  ctx.font = font(500, 38);
  ctx.fillText("Il mio", PAD, 150);
  ctx.globalAlpha = 1;
  ctx.font = font(800, 130);
  ctx.fillText(monthName.charAt(0).toUpperCase() + monthName.slice(1), PAD, 280);
  ctx.globalAlpha = 0.85;
  ctx.font = font(600, 48);
  ctx.fillText(String(year), PAD, 350);

  ctx.globalAlpha = 0.8;
  ctx.font = font(500, 36);
  ctx.fillText("Il mio profilo del mese", PAD, 520);
  ctx.globalAlpha = 1;
  ctx.font = font(800, 84);
  let y = 610;
  for (const line of wrap(ctx, story.archetype.name, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 92;
  }
  ctx.globalAlpha = 0.85;
  ctx.font = font(400, 36);
  y += 10;
  for (const line of wrap(ctx, story.archetype.description, WIDTH - PAD * 2)) {
    ctx.fillText(line, PAD, y);
    y += 48;
  }
  ctx.globalAlpha = 1;

  const top = story.categories[0];
  const stats = [
    {
      value:
        story.savingsRate !== null && story.saved >= 0 ? `${Math.round(story.savingsRate)}%` : "—",
      label: "risparmiato",
    },
    { value: String(story.noSpendDays), label: "giorni senza spese" },
    {
      value: top ? `${Math.round(top.share * 100)}%` : "—",
      label: top ? `in ${top.name}` : "per categoria",
    },
  ];
  const gap = 24;
  const boxW = (WIDTH - PAD * 2 - gap * 2) / 3;
  const boxY = 980;
  stats.forEach((s, i) => {
    const x = PAD + i * (boxW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(ctx, x, boxY, boxW, 230, 36);
    ctx.fill();
    ctx.fillStyle = "white";
    ctx.font = font(800, 72);
    ctx.fillText(s.value, x + 30, boxY + 100);
    ctx.globalAlpha = 0.85;
    ctx.font = font(500, 28);
    wrap(ctx, s.label, boxW - 50)
      .slice(0, 2)
      .forEach((line, j) => ctx.fillText(line, x + 30, boxY + 150 + j * 36));
    ctx.globalAlpha = 1;
  });

  ctx.globalAlpha = 0.8;
  ctx.font = font(600, 32);
  ctx.fillText("FinTrack", PAD, HEIGHT - 70);
  ctx.textAlign = "right";
  ctx.fillText("Il mese in storie", WIDTH - PAD, HEIGHT - 70);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
