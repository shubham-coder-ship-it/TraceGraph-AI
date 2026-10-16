/** FalkorDB 6.8.0 Graph.query already maps each column alias to its value. */
export function records<T extends object>(result: { data?: unknown }): T[] {
  if (!Array.isArray(result.data))
    throw new Error("Expected a query result with named records");
  for (const row of result.data) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error("Invalid FalkorDB record");
  }
  return result.data as T[];
}
export function first<T extends object>(result: {
  data?: unknown;
}): T | undefined {
  return records<T>(result)[0];
}
export function scalar(result: { data?: unknown }, alias: string): number {
  const row = first<Record<string, unknown>>(result);
  const value = row?.[alias];
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Missing numeric alias: ${alias}`);
  return value;
}
