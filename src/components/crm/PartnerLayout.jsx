import React, { useEffect } from "react";
import { Navigate, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Share2, Percent, Wallet, Link as LinkIcon, User } from "lucide-react";
import AppShell from "@/components/crm/AppShell";
import { useAuth } from "@/lib/AuthContext";
import { useCollection } from "@/hooks/crm";
import { Spinner } from "@/components/crm/ui";

const navItems = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/portal/referrals", label: "My Referrals", icon: Share2 },
  { to: "/portal/commissions", label: "Commissions", icon: Percent },
  { to: "/portal/payouts", label: "Payouts", icon: Wallet },
  { to: "/portal/link", label: "Referral Link", icon: LinkIcon },
  { to: "/portal/profile", label: "Profile", icon: User },
];

export default function PartnerLayout() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const { items: partners, loading } = useCollection("Partner", { user_id: user?.id });

  if (isLoadingAuth || !authChecked) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  if (loading) return <Spinner />;
  const partner = partners[0];
  if (!partner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="h-14 w-14 rounded-2xl bg-brand-soft/40 flex items-center justify-center mx-auto mb-4">
            <User className="h-7 w-7 text-brand" />
          </div>
          <h2 className="text-lg font-semibold">No partner account found</h2>
          <p className="text-sm text-muted-foreground mt-1">This account is not linked to a partner profile. Please contact Sasha Aesthetic Clinic to activate your partner access.</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell brand="Sasha Partner Portal" subtitle={partner.business_name} navItems={navItems} accentNote="Your role: Refer → Track → Earn. Share your link, we handle the rest.">
      <Outlet context={{ partner }} />
    </AppShell>
  );
}