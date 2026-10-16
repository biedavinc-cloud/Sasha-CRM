import { lazy, Suspense } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import SetupNeeded from '@/components/SetupNeeded';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import ApprovalGate from '@/components/ApprovalGate';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Layouts
const BackOfficeLayout = lazy(() => import('@/components/crm/BackOfficeLayout'));
const PartnerLayout = lazy(() => import('@/components/crm/PartnerLayout'));

// Back Office pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const Partners = lazy(() => import('@/pages/admin/Partners'));
const PartnerDetail = lazy(() => import('@/pages/admin/PartnerDetail'));
const Clients = lazy(() => import('@/pages/admin/Clients'));
const Leads = lazy(() => import('@/pages/admin/Leads'));
const Appointments = lazy(() => import('@/pages/admin/Appointments'));
const Services = lazy(() => import('@/pages/admin/Services'));
const Referrals = lazy(() => import('@/pages/admin/Referrals'));
const ReferralDetail = lazy(() => import('@/pages/admin/ReferralDetail'));
const Commissions = lazy(() => import('@/pages/admin/Commissions'));
const Payouts = lazy(() => import('@/pages/admin/Payouts'));
const Reports = lazy(() => import('@/pages/admin/Reports'));
const Users = lazy(() => import('@/pages/admin/Users'));
const Settings = lazy(() => import('@/pages/admin/Settings'));
const AuditLogs = lazy(() => import('@/pages/admin/AuditLogs'));
const GitHubPage = lazy(() => import('@/pages/admin/GitHub'));

// Partner Portal pages
const PartnerDashboard = lazy(() => import('@/pages/portal/Dashboard'));
const MyReferrals = lazy(() => import('@/pages/portal/MyReferrals'));
const MyCommissions = lazy(() => import('@/pages/portal/MyCommissions'));
const MyPayouts = lazy(() => import('@/pages/portal/MyPayouts'));
const ReferralLink = lazy(() => import('@/pages/portal/ReferralLink'));
const Profile = lazy(() => import('@/pages/portal/Profile'));

// Public pages
import ReferralLanding from '@/pages/public/ReferralLanding';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === 'admin' ? '/admin' : '/portal'} replace />;
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, checkUserAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-soft border-t-brand rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    return <SetupNeeded error={authError} onRetry={checkUserAuth} />;
  }

  return (
    <ApprovalGate>
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-soft border-t-brand rounded-full animate-spin"></div></div>}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/r/:code" element={<ReferralLanding />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<BackOfficeLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/partners" element={<Partners />} />
          <Route path="/admin/partners/:id" element={<PartnerDetail />} />
          <Route path="/admin/clients" element={<Clients />} />
          <Route path="/admin/leads" element={<Leads />} />
          <Route path="/admin/appointments" element={<Appointments />} />
          <Route path="/admin/services" element={<Services />} />
          <Route path="/admin/referrals" element={<Referrals />} />
          <Route path="/admin/referrals/:id" element={<ReferralDetail />} />
          <Route path="/admin/commissions" element={<Commissions />} />
          <Route path="/admin/payouts" element={<Payouts />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/settings" element={<Settings />} />
          <Route path="/admin/audit" element={<AuditLogs />} />
          <Route path="/admin/github" element={<GitHubPage />} />
        </Route>

        <Route element={<PartnerLayout />}>
          <Route path="/portal" element={<PartnerDashboard />} />
          <Route path="/portal/referrals" element={<MyReferrals />} />
          <Route path="/portal/commissions" element={<MyCommissions />} />
          <Route path="/portal/payouts" element={<MyPayouts />} />
          <Route path="/portal/link" element={<ReferralLink />} />
          <Route path="/portal/profile" element={<Profile />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    </ApprovalGate>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App