import { useMemo } from 'react';

type TablePaginationProps = {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange: (nextPageSize: number) => void;
  pageSizeOptions?: number[];
  label?: string;
};

export default function TablePagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  label = 'Rows per page',
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const range = useMemo(() => {
    if (totalItems === 0) return '0-0 of 0';
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(totalItems, safePage * pageSize);
    return `${start}-${end} of ${totalItems}`;
  }, [pageSize, safePage, totalItems]);

  return (
    <div className="table-pagination" role="navigation" aria-label="Table pagination">
      <label className="table-pagination__size">
        <span>{label}</span>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const nextSize = Number(e.target.value);
            if (Number.isFinite(nextSize) && nextSize > 0) {
              onPageSizeChange(nextSize);
            }
          }}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <span className="table-pagination__range">{range}</span>

      <div className="table-pagination__actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Prev
        </button>
        <span className="table-pagination__page">
          Page {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
