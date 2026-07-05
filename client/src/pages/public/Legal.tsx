import { PublicShell } from '@/components/public/PublicShell';

function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <div className="prose prose-slate mt-6 max-w-none space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {children}
        </div>
        <p className="mt-10 text-xs text-slate-400">Last updated {new Date().getFullYear()}.</p>
      </article>
    </PublicShell>
  );
}

export function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>Antariksha Trek Operations is a private internal platform. We process only the data needed to operate the service: account details (name, email, phone), the trek-permit records you submit, and operational/audit logs.</p>
      <p><strong>What we store.</strong> Ticket submissions, commission and payment records, refund records, notifications, and security logs (login attempts with IP/device for account protection).</p>
      <p><strong>How it's used.</strong> Strictly to calculate commissions, track payments and refunds, generate reports, and secure your account. We do not sell data and we do not process any payments inside the application.</p>
      <p><strong>Retention.</strong> Operational and financial records are retained for accounting and audit purposes and are never silently deleted.</p>
      <p><strong>Your access.</strong> Accounts are created by administrators. Contact an administrator to update or correct your information.</p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms of Use">
      <p>By accessing Antariksha you agree to use it solely for authorised internal trek-operations management.</p>
      <p><strong>Accounts.</strong> Access is granted by administrators; there is no public sign-up. You are responsible for keeping your credentials secure and for activity under your account.</p>
      <p><strong>Acceptable use.</strong> Submit accurate ticket information. Corrections are requested via the ticket comment system rather than direct edits, preserving data integrity.</p>
      <p><strong>No financial processing.</strong> The platform calculates and records only. It never initiates, authorises or processes money transfers; all payments and refunds occur outside the application.</p>
      <p><strong>Availability.</strong> The service is provided "as is" for internal operations. Administrators may disable accounts that violate these terms while preserving historical records.</p>
    </LegalPage>
  );
}
