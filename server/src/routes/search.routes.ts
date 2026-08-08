import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import { globalSearch } from '../services/search.service.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q } = z.object({ q: z.string().max(120).default('') }).parse(req.query);
    ok(res, await globalSearch(q, req.user!));
  }),
);

export default router;
