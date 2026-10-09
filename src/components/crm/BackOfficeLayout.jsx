import React from "react";
import { Navigate } from "react-router-dom";
import { Outlet } from "react-router-dom";
import { LayoutDashboard, Users, UserPlus, Calendar, Sparkles, Handshake, Share2, Percent, Wallet, ScrollText, FileBarChart, UserCog, Settings as SettingsIcon, Github } from "lucide-react";
import AppShell from "@/components/crm/AppShell";
import { useAuth } from "@/lib/AuthContext";
import { Spinner } from "@/components/crm/ui";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/leads", label: "Leads", icon: UserPlus },
  { to: "/admin/appointments", label: "Appointments", icon: Calendar },
  { to: "/admin/services", label: "Services", icon: Sparkles },
  { to: "/admin/partners", label: "Partners", icon: Handshake },
  { to: "/admin/referrals", label: "Referrals", icon: Share2 },
  { to: "/admin/commissions", label: "Commissions", icon: Percent },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/users", label: "Users", icon: UserCog },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
  { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/admin/github", label: "GitHub", icon: Github },
];

export default function BackOfficeLayout() {
  const { user, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/portal" replace />;

  return (
    <AppShell brand="Sasha Aesthetic Clinic" subtitle="Back Office" navItems={navItems} accentNote="JVC, Dubai · Internal CRM & Referral Management">
      <Outlet />
    </AppShell>
  );
}