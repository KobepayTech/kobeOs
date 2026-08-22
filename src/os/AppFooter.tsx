/**
 * Global footer rendered at the bottom of every app window's scroll area
 * (wired once in AppWindow). Gives every KobeOS module a consistent
 * "Contact us · © KobeOS <year>" end-of-page marker.
 */
export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="shrink-0 mt-auto border-t border-black/10 bg-white/30 px-4 py-3 text-center text-[11px] text-black/50">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <a
          href="mailto:support@kobepaytech.com"
          className="font-medium text-black/60 hover:text-indigo-600 transition-colors"
        >
          Contact us
        </a>
        <span className="text-black/20">•</span>
        <span>© {year} KobeOS</span>
        <span className="text-black/20">•</span>
        <span className="text-black/40">KobepayTech · All rights reserved</span>
      </div>
    </footer>
  );
}
