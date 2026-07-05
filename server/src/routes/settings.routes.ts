import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

// Read all settings as a key->value map (any authenticated user).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) throw new ApiError(500, error.message);
    const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
    ok(res, map);
  }),
);

// Upsert a setting — admin only.
const upsertSchema = z.object({ key: z.string().min(1), value: z.any() });
router.put(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { key, value } = upsertSchema.parse(req.body);
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select('key, value')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'settings.change', entity: 'settings', entityId: key, metadata: { value }, ip: req.ip });
    ok(res, data);
  }),
);

export default router;
