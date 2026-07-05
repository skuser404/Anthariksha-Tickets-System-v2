import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ticketPriority } from '../src/services/tickets.service.js';

test('danger-flagged tickets get higher priority (lower number) than clean ones', () => {
  const flagged = ticketPriority({ flags: [{ severity: 'danger' }], created_at: '2026-06-01' });
  const warning = ticketPriority({ flags: [{ severity: 'warning' }], created_at: '2026-06-01' });
  const clean = ticketPriority({ flags: [], created_at: '2026-06-01' });
  assert.equal(flagged, 0);
  assert.equal(warning, 1);
  assert.equal(clean, 1);
  assert.ok(flagged < clean);
});

test('priority tolerates a missing flags field', () => {
  assert.equal(ticketPriority({ created_at: '2026-06-01' }), 1);
});
