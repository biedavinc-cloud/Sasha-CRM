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
import BackOfficeLayout from '@/components/crm/BackOfficeLayout';
import PartnerLayout from '@/components/crm/PartnerLayout';

// Back Office pages
import AdminDashboard from '@/pages/admin/Dashboard';
import Partners from '@/pages/admin/Partners';
import PartnerDetail from '@/pages/admin/PartnerDetail';
import Clients from '@/pages/admin/Clients';
import Leads from '@/pages/admin/Leads';
import Appointments from '@/pages/admin/Appointments';
import Services from '@/pages/admin/Services';
import Referrals from '@/pages/admin/Referrals';
import ReferralDetail from '@/pages/admin/ReferralDetail';
import Commissions from '@/pages/admin/Commissions';
import Payouts from '@/pages/admin/Payouts';
import Reports from '@/pages/admin/Reports';
import Users from '@/pages/admin/Users';
import Settings from '@/pages/admin/Settings';
import AuditLogs from '@/pages/admin/AuditLogs';
import GitHubPage from '@/pages/admin/GitHub';

// Partner Portal pages
import PartnerDashboard from '@/pages/portal/Dashboard';
import MyReferrals from '@/pages/portal/MyReferrals';
import MyCommissions from '@/pages/portal/MyCommissions';
import MyPayouts from '@/pages/portal/MyPayouts';
import ReferralLink from '@/pages/portal/ReferralLink';
import Profile from '@/pages/portal/Profile';

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