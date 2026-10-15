/*
 * Where the guided tour puts its card: below the lit element, or above it, or against the far
 * edge of the screen when neither fits (big elements on small phones). Pure, so it's tested.
 */

export type Box = { top: number; left: number; width: number; height: number };

/** Between the frame of light and the card. */
export const GAP = 14;
/** From the edges of the screen. */
export const MARGIN = 12;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Where the card goes: below the element, or above, or against the far edge of the screen. */
export function placeCard(
  hole: Box | null,
  card: { width: number; height: number },
  screen: { width: number; height: number },
) {
  if (!hole) {
    return {
      top: Math.max(MARGIN, (screen.height - card.height) / 2),
      left: Math.max(MARGIN, (screen.width - card.width) / 2),
      arrow: null,
    };
  }
  const roomBelow = screen.height - (hole.top + hole.height) - GAP - MARGIN;
  const roomAbove = hole.top - GAP - MARGIN;
  let top: number;
  let side: "above" | "below" | null = null;
  if (roomBelow >= card.height) {
    top = hole.top + hole.height + GAP;
    side = "below";
  } else if (roomAbove >= card.height) {
    top = hole.top - GAP - card.height;
    side = "above";
  } else {
    top =
      hole.top + hole.height / 2 > screen.height / 2
        ? MARGIN
        : screen.height - card.height - MARGIN;
  }
  const left = clamp(
    hole.left + hole.width / 2 - card.width / 2,
    MARGIN,
    screen.width - card.width - MARGIN,
  );
  return {
    top: clamp(top, MARGIN, screen.height - card.height - MARGIN),
    left,
    arrow: side ? { side, x: clamp(hole.left + hole.width / 2 - left, 22, card.width - 22) } : null,
  };
}
