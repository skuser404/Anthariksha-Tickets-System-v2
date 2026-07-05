import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireSuper } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { sendMail } from '../lib/mailer.js';

const router = Router();
router.use(requireAuth, requireSuper);

// List all admins (admin + super-admin).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, is_active, is_super, last_login_at, created_at')
      .eq('role', 'admin')
      .order('created_at');
    if (error) throw new ApiError(500, error.message);
    ok(res, data ?? []);
  }),
);

const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8),
  isSuper: z.boolean().default(false),
});

// Create an admin (optionally super) — super-admin only.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const password_hash = await bcrypt.hash(b.password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ full_name: b.fullName, email: b.email, phone: b.phone ?? null, password_hash, role: 'admin', is_super: b.isSuper, is_active: true })
      .select('id, full_name, email, is_super')
      .single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Email already exists' : error.message);
    await audit({ actorId: req.user!.sub, action: b.isSuper ? 'admin.create_super' : 'admin.create', entity: 'user', entityId: data.id, ip: req.ip });
    try {
      await sendMail(b.email, 'Your Antariksha admin account', `<p>Hello ${b.fullName},</p><p>An ${b.isSuper ? 'super-' : ''}admin account has been created.</p><ul><li>Email: ${b.email}</li><li>Temporary password: <b>${b.password}</b></li></ul><p>Admin sign-in requires an email OTP. Change your password after first login.</p>`);
    } catch { /* non-critical */ }
    ok(res, data, 201);
  }),
);

// Edit an admin (name/email/phone/permissions/status) — super-admin only.
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const b = z
      .object({ fullName: z.string().min(2).optional(), email: z.string().email().optional(), phone: z.string().max(20).optional(), isActive: z.boolean().optional(), isSuper: z.boolean().optional() })
      .parse(req.body);

    // Guard: cannot demote the last remaining super-admin.
    if (b.isSuper === false) {
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('is_super', true);
      const { data: target } = await supabase.from('users').select('is_super').eq('id', req.params.id).maybeSingle();
      if (target?.is_super && (count ?? 0) <= 1) throw new ApiError(409, 'Cannot demote the last super-admin');
    }

    const patch: Record<string, unknown> = {};
    if (b.fullName !== undefined) patch.full_name = b.fullName;
    if (b.email !== undefined) patch.email = b.email;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (b.isActive !== undefined) patch.is_active = b.isActive;
    if (b.isSuper !== undefined) patch.is_super = b.isSuper;
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.params.id)
      .eq('role', 'admin')
      .select('id, full_name, email, phone, is_active, is_super')
      .single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Email already exists' : error.message);
    await audit({ actorId: req.user!.sub, action: 'admin.update', entity: 'user', entityId: req.params.id, metadata: patch, ip: req.ip });
    ok(res, data);
  }),
);

// Delete an admin — super-admin only; requires password confirmation;
// cannot delete yourself or the last super-admin.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
    if (req.params.id === req.user!.sub) throw new ApiError(409, 'You cannot delete your own account');

    // Confirm the acting super-admin's password (2FA-grade re-auth).
    const { data: me } = await supabase.from('users').select('password_hash').eq('id', req.user!.sub).single();
    if (!me || !(await bcrypt.compare(password, me.password_hash))) throw new ApiError(401, 'Password confirmation failed');

    const { data: target } = await supabase.from('users').select('id, role, is_super').eq('id', req.params.id).maybeSingle();
    if (!target || target.role !== 'admin') throw new ApiError(404, 'Admin not found');
    if (target.is_super) {
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('is_super', true);
      if ((count ?? 0) <= 1) throw new ApiError(409, 'Cannot delete the last super-admin');
    }

    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'admin.delete', entity: 'user', entityId: req.params.id, ip: req.ip });
    ok(res, { ok: true });
  }),
);

export default router;
