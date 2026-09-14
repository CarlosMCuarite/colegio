import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenValido } from '../utils/secureToken';

test('health exige un secreto exacto', () => {
  assert.equal(tokenValido(undefined, 'seguro'), false);
  assert.equal(tokenValido('incorrecto', 'seguro'), false);
  assert.equal(tokenValido('seguro', 'seguro'), true);
});
