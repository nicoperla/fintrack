/** Re-mounted on every navigation, so each page plays its entrance (see .app-page in globals.css). */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="app-page">{children}</div>;
}
