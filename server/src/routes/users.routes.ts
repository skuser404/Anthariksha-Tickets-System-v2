import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';
import { sendMail } from '../lib/mailer.js';

const router = Router();
router.use(requireAuth);

/** Email login credentials to a newly created / reset account (best effort). */
async function emailCredentials(email: string, name: string, password: string, isNew: boolean) {
  try {
    await sendMail(
      email,
      isNew ? 'Your Antariksha account is ready' : 'Your Antariksha password was reset',
      `<p>Hello ${name},</p>
       <p>${isNew ? 'An account has been created for you.' : 'Your password has been reset by an administrator.'}</p>
       <ul><li>Email: ${email}</li><li>Temporary password: <b>${password}</b></li></ul>
       <p>Please sign in and change your password under Profile → Security.</p>`,
    );
  } catch { /* non-critical */ }
}

// List members (for admin selectors + Members page) — admin only.
router.get(
  '/members',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, is_active, last_login_at, created_at')
      .eq('role', 'member')
      .order('full_name');
    if (error) throw new ApiError(500, error.message);

    // Attach financial summary.
    const { data: fin } = await supabase.from('member_financials').select('member_id, total_earned, total_paid, balance');
    const finMap = new Map((fin ?? []).map((f) => [f.member_id, f]));
    const rows = (data ?? []).map((m) => ({ ...m, ...(finMap.get(m.id) ?? { total_earned: 0, total_paid: 0, balance: 0 }) }));
    ok(res, rows);
  }),
);

// Create a member account — admin only.
const createSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().max(20).optional(),
  password: z.string().min(8),
});
router.post(
  '/members',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = createSchema.parse(req.body);
    const password_hash = await bcrypt.hash(b.password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert({ full_name: b.fullName, email: b.email, phone: b.phone ?? null, password_hash, role: 'member', is_active: true })
      .select('id, full_name, email, is_active')
      .single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Email already exists' : error.message);
    await audit({ actorId: req.user!.sub, action: 'member.create', entity: 'user', entityId: data.id, ip: req.ip });
    await emailCredentials(b.email, b.fullName, b.password, true);
    ok(res, data, 201);
  }),
);

// Edit a member's profile fields — admin only.
router.patch(
  '/members/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = z
      .object({ fullName: z.string().min(2).optional(), email: z.string().email().optional(), phone: z.string().max(20).optional(), isActive: z.boolean().optional() })
      .parse(req.body);
    const patch: Record<string, unknown> = {};
    if (b.fullName !== undefined) patch.full_name = b.fullName;
    if (b.email !== undefined) patch.email = b.email;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (b.isActive !== undefined) patch.is_active = b.isActive;
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.params.id)
      .eq('role', 'member')
      .select('id, full_name, email, phone, is_active')
      .single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'Email already exists' : error.message);
    await audit({ actorId: req.user!.sub, action: 'member.update', entity: 'user', entityId: req.params.id, metadata: patch, ip: req.ip });
    ok(res, data);
  }),
);

// Reset a member's password to a fresh random value (emailed) — admin only.
router.post(
  '/members/:id/reset-password',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { data: member } = await supabase.from('users').select('full_name, email, role').eq('id', req.params.id).maybeSingle();
    if (!member || member.role !== 'member') throw new ApiError(404, 'Member not found');
    const password = 'Av' + Math.random().toString(36).slice(2, 8) + '@' + Math.floor(10 + Math.random() * 89);
    await supabase.from('users').update({ password_hash: await bcrypt.hash(password, 10) }).eq('id', req.params.id);
    await audit({ actorId: req.user!.sub, action: 'member.reset_password', entity: 'user', entityId: req.params.id, ip: req.ip });
    await emailCredentials(member.email, member.full_name, password, false);
    ok(res, { ok: true, tempPassword: password });
  }),
);

// Permanently delete a member — SUPER-ADMIN only, with guards.
router.delete(
  '/members/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    // A member with ANY tickets, payments or ledger history cannot be permanently
    // deleted — those records reference the member (and the ledger is immutable),
    // so their history is preserved. Such accounts should be disabled instead.
    const [{ data: member }, { count: ticketCount }, { count: paymentCount }, { count: ledgerCount }, { data: fin }] = await Promise.all([
      supabase.from('users').select('id, role').eq('id', id).maybeSingle(),
      supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('member_id', id),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('member_id', id),
      supabase.from('ledger_entries').select('id', { count: 'exact', head: true }).eq('member_id', id),
      supabase.from('member_financials').select('balance').eq('member_id', id).maybeSingle(),
    ]);
    if (!member || member.role !== 'member') throw new ApiError(404, 'Member not found');

    const reasons: string[] = [];
    if ((ticketCount ?? 0) > 0) reasons.push(`${ticketCount} ticket(s)`);
    if ((paymentCount ?? 0) > 0) reasons.push(`${paymentCount} payment(s)`);
    if ((ledgerCount ?? 0) > 0) reasons.push('ledger history');
    if (Number(fin?.balance ?? 0) > 0) reasons.push('an outstanding balance');

    if (reasons.length > 0) {
      throw new ApiError(
        409,
        `This member has ${reasons.join(', ')}, so their records are kept — permanent delete isn't allowed. Disable the account instead (they keep all history but can't log in).`,
      );
    }

    // Clean account (no history): remove it. Dependent rows (otp, notifications) cascade.
    const { error } = await supabase.from('users').delete().eq('id', id).eq('role', 'member');
    if (error) throw new ApiError(500, `Delete failed: ${error.message}`);
    await audit({ actorId: req.user!.sub, action: 'member.delete', entity: 'user', entityId: id, ip: req.ip });
    ok(res, { ok: true });
  }),
);

// FORCE delete — permanently wipes the member AND all their records (tickets,
// payments, refunds, ledger). Destructive & irreversible. Admin only.
router.post(
  '/members/:id/purge',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { data: member } = await supabase.from('users').select('id, role, full_name').eq('id', id).maybeSingle();
    if (!member || member.role !== 'member') throw new ApiError(404, 'Member not found');

    const { error } = await supabase.rpc('purge_member', { p_member: id });
    if (error) throw new ApiError(500, `Purge failed: ${error.message}`);

    await audit({ actorId: req.user!.sub, action: 'member.purge', entity: 'user', entityId: id, metadata: { full_name: member.full_name }, ip: req.ip });
    ok(res, { ok: true });
  }),
);

// Full member profile (performance + history) — admin only.
router.get(
  '/members/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const [{ data: user }, { data: tickets }, { data: payments }, { data: fin }, { data: logins }] = await Promise.all([
      supabase.from('users').select('id, full_name, email, phone, is_active, last_login_at, created_at').eq('id', id).maybeSingle(),
      supabase.from('tickets').select('id, ticket_code, trek_name, persons, commission_amount, status, trek_date, created_at').eq('member_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('id, amount, payment_date, method, receipt_no').eq('member_id', id).order('payment_date', { ascending: false }),
      supabase.from('member_financials').select('total_earned, total_paid, balance').eq('member_id', id).maybeSingle(),
      supabase.from('login_attempts').select('success, stage, ip_address, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ]);
    if (!user) throw new ApiError(404, 'Member not found');

    const t = tickets ?? [];
    const decided = t.filter((x) => ['approved', 'not_confirmed'].includes(x.status));
    const approvalRate = decided.length ? Math.round((decided.filter((x) => x.status === 'approved').length / decided.length) * 100) : 0;
    const workingDays = new Set(t.map((x) => x.trek_date)).size;

    ok(res, {
      user,
      financials: { totalEarned: Number(fin?.total_earned ?? 0), totalPaid: Number(fin?.total_paid ?? 0), balance: Number(fin?.balance ?? 0) },
      performance: {
        totalTickets: t.length,
        approvalRate,
        avgTicketsPerDay: workingDays ? Math.round((t.length / workingDays) * 10) / 10 : 0,
        workingDays,
      },
      tickets: t.slice(0, 25),
      payments: payments ?? [],
      loginHistory: logins ?? [],
    });
  }),
);

// The signed-in user's own profile.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, is_super, avatar_url, totp_enabled, email_2fa, login_alerts, last_login_at, created_at')
      .eq('id', req.user!.sub)
      .single();
    if (error) throw new ApiError(500, error.message);
    ok(res, data);
  }),
);

// Signed URL to upload an avatar straight to the public `avatars` bucket.
router.post(
  '/me/avatar-url',
  asyncHandler(async (req, res) => {
    const { fileName } = z.object({ fileName: z.string().min(1) }).parse(req.body);
    const ext = (fileName.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${req.user!.sub}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('avatars').createSignedUploadUrl(path);
    if (error) throw new ApiError(500, `Storage error: ${error.message}`);
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    ok(res, { path, signedUrl: data.signedUrl, publicUrl: pub.publicUrl });
  }),
);

// Security preferences: members may opt into email-OTP 2FA; anyone toggles login alerts.
router.patch(
  '/me/security',
  asyncHandler(async (req, res) => {
    const b = z.object({ email2fa: z.boolean().optional(), loginAlerts: z.boolean().optional() }).parse(req.body);
    const patch: Record<string, unknown> = {};
    // Admins always have 2FA; the toggle only applies to members.
    if (b.email2fa !== undefined && req.user!.role === 'member') patch.email_2fa = b.email2fa;
    if (b.loginAlerts !== undefined) patch.login_alerts = b.loginAlerts;
    const { data, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', req.user!.sub)
      .select('email_2fa, login_alerts')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'security.update', entity: 'user', entityId: req.user!.sub, metadata: patch, ip: req.ip });
    ok(res, data);
  }),
);

const updateMeSchema = z.object({ fullName: z.string().min(2).optional(), phone: z.string().max(20).optional(), avatarUrl: z.string().url().optional() });
router.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const b = updateMeSchema.parse(req.body);
    const patch: Record<string, unknown> = {};
    if (b.fullName !== undefined) patch.full_name = b.fullName;
    if (b.phone !== undefined) patch.phone = b.phone;
    if (b.avatarUrl !== undefined) patch.avatar_url = b.avatarUrl;
    const { data, error } = await supabase.from('users').update(patch).eq('id', req.user!.sub).select('id, full_name, phone, avatar_url').single();
    if (error) throw new ApiError(500, error.message);
    ok(res, data);
  }),
);

// Change own password.
router.post(
  '/me/password',
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string(), newPassword: z.string().min(8) })
      .parse(req.body);
    const { data: user } = await supabase.from('users').select('password_hash').eq('id', req.user!.sub).single();
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    const password_hash = await bcrypt.hash(newPassword, 10);
    await supabase.from('users').update({ password_hash }).eq('id', req.user!.sub);
    await audit({ actorId: req.user!.sub, action: 'password.change', entity: 'user', entityId: req.user!.sub, ip: req.ip });
    ok(res, { ok: true });
  }),
);

export default router;
