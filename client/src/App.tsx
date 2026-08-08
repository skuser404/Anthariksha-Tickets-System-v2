import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import NotFoundPage from './pages/NotFound';
import type { ReactNode } from 'react';

// Route pages are lazy-loaded so each is a separate chunk (faster first paint).
//
// DashboardLayout is lazy too, and deliberately so: it pulls in framer-motion,
// the command palette, the AI assistant and the notification bell. Importing it
// statically put all of that in the entry chunk, so an anonymous visitor landing
// on the marketing page paid to download the whole authenticated app shell.
const DashboardLayout = lazy(() =>
  import('./components/layout/DashboardLayout').then((m) => ({ default: m.DashboardLayout })),
);
const LoginPage = lazy(() => import('./pages/Login'));

// Landing is the anonymous entry point, so it is imported eagerly on purpose:
// lazy-loading it added a second network round trip (index.js -> Landing.js ->
// PublicShell.js) before the hero could paint, which on throttled mobile cost
// more than the bytes saved. It carries no heavy dependencies of its own.
import Landing from './pages/public/Landing';

const Contact = lazy(() => import('./pages/public/Contact'));
const Privacy = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/public/Legal').then((m) => ({ default: m.Terms })));

const MemberDashboard = lazy(() => import('./pages/MemberDashboard'));
const TicketsPage = lazy(() => import('./pages/Tickets'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetail'));
const AddTicketPage = lazy(() => import('./pages/AddTicket'));
const EarningsPage = lazy(() => import('./pages/Earnings'));
// Cancellation/refund is retired: the live flow is pending -> approved | rejected.
// The page and its API are left in the repo so historical refunds stay readable
// if the route is ever re-enabled, but it is no longer reachable or linked.
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const HelpPage = lazy(() => import('./pages/Help'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTicketsPage = lazy(() => import('./pages/admin/AdminTickets'));
const OriginalTicketsPage = lazy(() => import('./pages/admin/OriginalTickets'));
const ReplacementsPage = lazy(() => import('./pages/admin/Replacements'));
const PaymentsPage = lazy(() => import('./pages/admin/Payments'));
const MoneyFlowPage = lazy(() => import('./pages/admin/MoneyFlow'));
const MembersPage = lazy(() => import('./pages/admin/Members'));
const MemberProfilePage = lazy(() => import('./pages/admin/MemberProfile'));
const ReportsPage = lazy(() => import('./pages/admin/Reports'));
const AnalyticsPage = lazy(() => import('./pages/admin/Analytics'));
const TreksPage = lazy(() => import('./pages/admin/Treks'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogs'));
const SettingsPage = lazy(() => import('./pages/admin/Settings'));
const LedgerPage = lazy(() => import('./pages/admin/Ledger'));
const LeaderboardPage = lazy(() => import('./pages/admin/Leaderboard'));
const ActivityFeedPage = lazy(() => import('./pages/admin/ActivityFeed'));
const CalendarPage = lazy(() => import('./pages/admin/Calendar'));
const AdminsPage = lazy(() => import('./pages/admin/Admins'));
const DriveSettingsPage = lazy(() => import('./pages/admin/DriveSettings'));
const TrekDatesPage = lazy(() => import('./pages/admin/TrekDates'));
const AnnouncementsPage = lazy(() => import('./pages/admin/Announcements'));

const adminOnly = (node: ReactNode) => <RoleGate roles={['admin']}>{node}</RoleGate>;
const superOnly = (node: ReactNode) => <RoleGate roles={['admin']} superOnly>{node}</RoleGate>;

function RoleGate({ children, roles, superOnly }: { children: ReactNode; roles?: Array<'admin' | 'member'>; superOnly?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  if (superOnly && !user.isSuper) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminDashboard /> : <MemberDashboard />;
}

/** Fallback for lazily-loaded routes that render outside DashboardLayout. */
function RouteFallback() {
  return (
    <div className="app-bg grid min-h-screen place-items-center">
      <Loader2 className="animate-spin text-brand-500" size={28} />
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return null;

  // Public pages are lazy-loaded but render outside DashboardLayout, which is
  // where the only other Suspense boundary lives. Without this one React simply
  // holds the commit until the chunk arrives — no crash, but no loading state
  // either, so a slow network looks like a hung blank page.
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public pages — always reachable */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {user ? (
          // ---------- Authenticated app ----------
          <Route element={<DashboardLayout />}>
            <Route index element={<RoleHome />} />
            <Route path="/tickets" element={<TicketsPage />} />
            <Route path="/tickets/new" element={<AddTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/help" element={<HelpPage />} />

            {/* Admin */}
            <Route path="/admin/tickets" element={adminOnly(<AdminTicketsPage />)} />
            <Route path="/admin/originals" element={adminOnly(<OriginalTicketsPage />)} />
            <Route path="/admin/replacements" element={adminOnly(<ReplacementsPage />)} />
            <Route path="/admin/payments" element={adminOnly(<PaymentsPage />)} />
            <Route path="/admin/money-flow" element={adminOnly(<MoneyFlowPage />)} />
            <Route path="/admin/ledger" element={adminOnly(<LedgerPage />)} />
            <Route path="/admin/leaderboard" element={adminOnly(<LeaderboardPage />)} />
            <Route path="/admin/activity" element={adminOnly(<ActivityFeedPage />)} />
            <Route path="/admin/calendar" element={adminOnly(<CalendarPage />)} />
            <Route path="/admin/members" element={adminOnly(<MembersPage />)} />
            <Route path="/admin/members/:id" element={adminOnly(<MemberProfilePage />)} />
            <Route path="/admin/reports" element={adminOnly(<ReportsPage />)} />
            <Route path="/admin/analytics" element={adminOnly(<AnalyticsPage />)} />
            <Route path="/admin/treks" element={adminOnly(<TreksPage />)} />
          <Route path="/admin/trek-dates" element={adminOnly(<TrekDatesPage />)} />
          <Route path="/admin/announcements" element={adminOnly(<AnnouncementsPage />)} />
            <Route path="/admin/audit" element={adminOnly(<AuditLogsPage />)} />
            <Route path="/admin/settings" element={adminOnly(<SettingsPage />)} />
            {/* Super-admin only */}
            <Route path="/admin/admins" element={superOnly(<AdminsPage />)} />
            <Route path="/admin/drive" element={superOnly(<DriveSettingsPage />)} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        ) : (
          // ---------- Public site ----------
          <>
            <Route path="/" element={<Landing />} />
            {/* Any protected path while logged out → login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </Suspense>
  );
}
