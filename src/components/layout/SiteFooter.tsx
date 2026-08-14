/**
 * One footer, used by both the marketing page and the app shell.
 *
 * It existed twice as identical markup, which meant two places to change and
 * two places to forget. The old version set its own 11px size and its own
 * uppercase tracking, so it was also the smallest text in the product for no
 * reason other than being last on the page.
 */

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={`border-t border-separator px-(--pad-page-x) py-6 mt-auto ${className ?? ""}`}
    >
      <p className="text-meta text-label-3 text-center">
        GuildBoard for Skillrev
      </p>
    </footer>
  );
}
