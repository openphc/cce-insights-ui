import { useState, type ReactNode } from 'react';

interface PagedListProps<T> {
  items: T[];
  /** How many items a page shows. */
  pageSize: number;
  /** Names the list for screen readers, such as "Deviations". */
  label: string;
  renderItem: (item: T) => ReactNode;
  className?: string;
}

/**
 * A list shown a page at a time, with a small pager under it: "1–5 of 12", then ‹ and ›. With a
 * single page, the pager is left out. Give it a `key` to start again at page 1, such as when another
 * protocol is picked. If the list shrinks under the page shown, the last page is shown instead.
 */
export function PagedList<T>({ items, pageSize, label, renderItem, className = 'space-y-2' }: PagedListProps<T>) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const shownPage = Math.min(page, pageCount - 1);
  const start = shownPage * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <div>
      <div className={className}>{pageItems.map(renderItem)}</div>
      {pageCount > 1 && (
        <nav aria-label={`${label} pages`} className="mt-2 flex items-center justify-end gap-2">
          <span className="text-xs text-gray-500">
            {start + 1}–{start + pageItems.length} of {items.length}
          </span>
          <button
            type="button"
            onClick={() => setPage(shownPage - 1)}
            disabled={shownPage === 0}
            aria-label={`Previous ${label.toLowerCase()}`}
            className="rounded px-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="text-lg leading-none" aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => setPage(shownPage + 1)}
            disabled={shownPage === pageCount - 1}
            aria-label={`Next ${label.toLowerCase()}`}
            className="rounded px-1.5 text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="text-lg leading-none" aria-hidden="true">›</span>
          </button>
        </nav>
      )}
    </div>
  );
}
