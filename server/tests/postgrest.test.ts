import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orIlike, sanitiseLikeTerm } from '../src/lib/postgrest.js';

test('a plain term is preserved', () => {
  assert.equal(sanitiseLikeTerm('AV-100231'), 'AV-100231');
  assert.equal(sanitiseLikeTerm('Kudremukh Trek'), 'Kudremukh Trek');
});

// PostgREST parses commas, parentheses and dots as filter structure, so an
// unsanitised term could append conditions to the generated `or=(...)` group.
test('PostgREST filter metacharacters are stripped', () => {
  assert.equal(sanitiseLikeTerm('a,b'), 'a b');
  assert.equal(sanitiseLikeTerm('x),status.eq.approved'), 'x status eq approved');
  assert.equal(sanitiseLikeTerm("O'Brien"), 'O Brien');
  assert.equal(sanitiseLikeTerm('back\\slash'), 'back slash');
});

test('LIKE wildcards cannot be injected', () => {
  assert.equal(sanitiseLikeTerm('%'), '');
  assert.equal(sanitiseLikeTerm('a%b_c'), 'a b c');
});

test('terms are length-capped', () => {
  assert.equal(sanitiseLikeTerm('a'.repeat(500)).length, 100);
});

test('orIlike builds one clause per column with the sanitised term', () => {
  assert.equal(
    orIlike(['ticket_code', 'trek_name'], 'kudre'),
    'ticket_code.ilike.%kudre%,trek_name.ilike.%kudre%',
  );
});

test('orIlike cannot be broken out of by a crafted term', () => {
  const built = orIlike(['ticket_code'], 'x),member_id.neq.00000000-0000-0000-0000-000000000000');
  // Exactly one clause, and no stray closing paren or comma-separated condition.
  assert.equal(built.split(',').length, 1);
  assert.ok(!built.includes(')'));
  assert.ok(!built.includes('.neq.'));
});
