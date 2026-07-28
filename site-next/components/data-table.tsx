export interface DataTableColumn {
  label: React.ReactNode;
  align?: "left" | "right";
}

export function DataTable({
  columns,
  rows,
}: {
  columns: (string | DataTableColumn)[];
  rows: React.ReactNode[][];
}) {
  const cols = columns.map((c) => (typeof c === "string" ? { label: c } : c));
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-xs font-medium uppercase tracking-wide text-text-subtle">
            {cols.map((c, i) => (
              <th key={i} className={"px-4 py-2.5 " + (c.align === "right" ? "text-right" : "")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-faint last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={"px-4 py-2.5 text-text-muted " + (cols[j]?.align === "right" ? "text-right" : "")}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
