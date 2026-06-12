import { Response } from "express";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Flattens one level of nesting: { branch: { name } } → column "branch.name"
function flatten(row: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      for (const [k2, v2] of Object.entries(value as Record<string, unknown>)) {
        flat[`${key}.${k2}`] = v2;
      }
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

export function sendCsv(res: Response, filename: string, rows: Record<string, unknown>[]) {
  const flatRows = rows.map(flatten);
  const headers = [...new Set(flatRows.flatMap((r) => Object.keys(r)))];
  const lines = [
    headers.join(","),
    ...flatRows.map((row) => headers.map((h) => escapeCell(row[h])).join(",")),
  ];

  res
    .status(200)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`)
    .send(lines.join("\n"));
}
