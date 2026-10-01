/**
 * The sky behind the app (styles in globals.css, "App" section): two slow auroras, and in the dark
 * theme drifting, twinkling stars with a little film grain; in the light theme a faint dot grid.
 * Pure CSS, composited animations only, still with reduced motion.
 */
export function AppBackdrop() {
  return (
    <div aria-hidden className="app-backdrop">
      <div className="app-backdrop__dots" />
      <div className="app-backdrop__aurora" />
      <div className="app-backdrop__horizon" />
      <div className="app-backdrop__stars" />
      <div className="app-backdrop__twinkle" />
      <div className="app-backdrop__grain lp-grain" />
    </div>
  );
}
