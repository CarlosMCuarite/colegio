// src/utils/response.ts — Helpers de respuesta estandarizada
import { Response } from 'express';

export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ ok: true, data });

export const created = (res: Response, data: unknown) =>
  res.status(201).json({ ok: true, data });

export const paginated = (res: Response, data: unknown[], total: number, page: number, limit: number) =>
  res.json({ ok: true, data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
