// src/utils/pagination.ts
export function parsePagination(query: Record<string, string>, defaultLimit = 50) {
  const page  = Math.max(1, parseInt(query.page  || '1', 10));
  const limit = Math.min(200, parseInt(query.limit || String(defaultLimit), 10));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}
