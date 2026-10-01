/*
 * The landing page's sky colours: slowly drifting nebulae behind everything (also behind the sign-in
 * pages). Plain markup with CSS animations, so it doesn't pull the animation library into the page.
 */

export function Nebula() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
      <div
        className="lp-motion absolute -top-[20%] -left-[10%] size-[70vmax] rounded-full opacity-40 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(99,102,241,0.55), transparent 60%)",
          animation: "lp-drift-a 26s ease-in-out infinite",
        }}
      />
      <div
        className="lp-motion absolute top-[30%] -right-[20%] size-[60vmax] rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(217,70,239,0.5), transparent 60%)",
          animation: "lp-drift-b 32s ease-in-out infinite",
        }}
      />
      <div
        className="lp-motion absolute -bottom-[30%] left-[20%] size-[60vmax] rounded-full opacity-25 blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,0.45), transparent 60%)",
          animation: "lp-drift-a 38s ease-in-out infinite reverse",
        }}
      />
      <div className="lp-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
    </div>
  );
}
