import test from 'node:test';
import assert from 'node:assert/strict';
import { Request } from 'express';
import { RolNombre } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { extractAuthToken, requireRol, AuthUser } from '../middleware/auth';
import { requireTenant, resolveTenant } from '../middleware/tenant';

function request(user?: Partial<AuthUser>, headers: Record<string, string> = {}) {
  return {
    headers,
    user: user as AuthUser | undefined,
  } as unknown as Request;
}

const response = {} as any;

test('la cookie HttpOnly tiene prioridad sobre un Bearer heredado', () => {
  const req = request(undefined, { authorization: 'Bearer token-antiguo' }) as any;
  req.cookies = { sige_access_token: 'token-cookie' };
  assert.equal(extractAuthToken(req), 'token-cookie');
});

test('una petición sin cookie ni Bearer no tiene token de sesión', () => {
  assert.equal(extractAuthToken(request()), undefined);
});

test('un usuario normal no puede falsificar el colegio mediante X-Colegio-Id', () => {
  const req = request(
    { colegioId: 'colegio-propio', rol: RolNombre.ADMINISTRADOR },
    { 'x-colegio-id': 'colegio-ajeno' },
  ) as any;
  let continuo = false;
  resolveTenant(req, response, () => { continuo = true; });
  assert.equal(req.colegioId, 'colegio-propio');
  assert.equal(continuo, true);
});

test('solo SUPERADMIN puede seleccionar explícitamente otro colegio', () => {
  const req = request(
    { colegioId: null, rol: RolNombre.SUPERADMIN },
    { 'x-colegio-id': 'colegio-seleccionado' },
  ) as any;
  resolveTenant(req, response, () => {});
  assert.equal(req.colegioId, 'colegio-seleccionado');
});

test('requireTenant rechaza operaciones institucionales sin colegio', () => {
  const req = request({ colegioId: null, rol: RolNombre.ADMINISTRADOR }) as any;
  assert.throws(
    () => requireTenant(req, response, () => {}),
    (error: unknown) => error instanceof AppError && error.statusCode === 400,
  );
});

test('un PADRE no supera un guard reservado a administración', () => {
  const req = request({ colegioId: 'colegio-1', rol: RolNombre.PADRE });
  const soloAdministracion = requireRol(
    RolNombre.SUPERADMIN,
    RolNombre.ADMINISTRADOR,
    RolNombre.DIRECTOR,
    RolNombre.SECRETARIA,
  );
  assert.throws(
    () => soloAdministracion(req, response, () => {}),
    (error: unknown) => error instanceof AppError && error.statusCode === 403,
  );
});

test('SECRETARIA sí supera el guard de administración de estudiantes', () => {
  const req = request({ colegioId: 'colegio-1', rol: RolNombre.SECRETARIA });
  let continuo = false;
  requireRol(
    RolNombre.SUPERADMIN,
    RolNombre.ADMINISTRADOR,
    RolNombre.DIRECTOR,
    RolNombre.SECRETARIA,
  )(req, response, () => { continuo = true; });
  assert.equal(continuo, true);
});
