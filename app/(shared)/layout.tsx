/** Pages opened through a shared link, by people without an account: no app menus. */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-b print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
          <span className="font-semibold tracking-tight">FinTrack</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
