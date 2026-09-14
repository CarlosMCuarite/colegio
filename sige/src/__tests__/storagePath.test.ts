import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStoragePath } from '../utils/storagePath';

test('normaliza rutas históricas y URLs de Storage', () => {
  assert.equal(normalizeStoragePath('documentos/colegio/a.pdf', 'documentos'), 'colegio/a.pdf');
  assert.equal(normalizeStoragePath('documentos/documentos/colegio/a.pdf', 'documentos'), 'colegio/a.pdf');
  assert.equal(normalizeStoragePath('https://x.supabase.co/storage/v1/object/public/documentos/colegio/a%20b.pdf', 'documentos'), 'colegio/a b.pdf');
  assert.equal(normalizeStoragePath('https://x.supabase.co/storage/v1/object/sign/documentos/colegio/a.pdf?token=x', 'documentos'), 'colegio/a.pdf');
});

test('rechaza rutas ajenas o inseguras', () => {
  assert.equal(normalizeStoragePath('../secreto', 'documentos'), null);
  assert.equal(normalizeStoragePath('https://example.com/a.pdf', 'documentos'), null);
  assert.equal(normalizeStoragePath('', 'documentos'), null);
});
