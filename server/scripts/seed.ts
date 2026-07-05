/**
 * Seeds demo accounts + sample tickets with correctly hashed passwords.
 * Run AFTER applying the SQL migrations:  npm --workspace server run seed
 *
 * Demo credentials (change in production!):
 *   Admin   admin@antariksha.test  / Admin@123   (2FA email OTP on login)
 *   Member  ravi@antariksha.test   / Member@123
 *   Member  asha@antariksha.test   / Member@123
 */
import bcrypt from 'bcryptjs';
import { supabase } from '../src/lib/supabase.js';

async function upsertUser(u: {
  full_name: string;
  email: string;
  password: string;
  role: 'admin' | 'member';
  isSuper?: boolean;
}) {
  const password_hash = await bcrypt.hash(u.password, 10);
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { full_name: u.full_name, email: u.email, password_hash, role: u.role, is_active: true, is_super: u.isSuper ?? false },
      { onConflict: 'email' },
    )
    .select('id, email, role')
    .single();
  if (error) throw error;
  console.log(`  ✓ ${(u.isSuper ? 'super' : data.role).padEnd(6)} ${data.email}`);
  return data;
}

async function main() {
  console.log('Seeding users...');
  await upsertUser({ full_name: 'Antariksha Admin', email: 'admin@antariksha.test', password: 'Admin@123', role: 'admin', isSuper: true });
  const ravi = await upsertUser({ full_name: 'Ravi Kumar', email: 'ravi@antariksha.test', password: 'Member@123', role: 'member' });
  const asha = await upsertUser({ full_name: 'Asha Rao', email: 'asha@antariksha.test', password: 'Member@123', role: 'member' });

  const { data: treks } = await supabase.from('trek_pricing').select('id, name, permit_price');
  const trekByName = new Map((treks ?? []).map((t) => [t.name, t]));

  console.log('Seeding sample tickets...');
  const samples = [
    { member: ravi.id, code: 'AV-100231', trek: 'Kudremukh', persons: 3, status: 'approved', booking: '2026-06-01', trekDate: '2026-06-15' },
    { member: ravi.id, code: 'AV-100244', trek: 'Netravati', persons: 2, status: 'pending_verification', booking: '2026-06-20', trekDate: '2026-07-05' },
    { member: asha.id, code: 'AV-100250', trek: 'Bandaje Falls', persons: 4, status: 'approved', booking: '2026-06-10', trekDate: '2026-06-25' },
    { member: asha.id, code: 'AV-100261', trek: 'Kurinjal', persons: 1, status: 'not_confirmed', booking: '2026-06-12', trekDate: '2026-06-30' },
  ];

  for (const s of samples) {
    const trek = trekByName.get(s.trek)!;
    const { error } = await supabase.from('tickets').upsert(
      {
        ticket_code: s.code,
        member_id: s.member,
        trek_id: trek.id,
        trek_name: s.trek,
        booking_email: 'bookings@aranyavihara.test',
        booking_date: s.booking,
        trek_date: s.trekDate,
        persons: s.persons,
        permit_price: trek.permit_price,
        commission_per_person: 50,
        status: s.status,
      },
      { onConflict: 'ticket_code' },
    );
    if (error) throw error;
    console.log(`  ✓ ${s.code} (${s.status})`);
  }

  console.log('\nDone. Login with admin@antariksha.test / Admin@123 (OTP printed to server log in dev).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
