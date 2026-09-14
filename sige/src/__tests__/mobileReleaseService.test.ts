import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBuild } from '../services/mobileReleaseService';
test('compara versión semántica y build', () => {
  assert.equal(compareBuild('1.0.0', 1, '1.0.1', 1), true);
  assert.equal(compareBuild('1.0.0', 2, '1.0.0', 3), true);
  assert.equal(compareBuild('2.0.0', 1, '1.9.9', 99), false);
});
