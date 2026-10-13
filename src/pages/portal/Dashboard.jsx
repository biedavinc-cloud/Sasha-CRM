import React, { useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Share2, Wallet, TrendingUp, Copy, Check, ArrowUpRight } from "lucide-react";
import { useCount, useCollection, useAggregate } from "@/hooks/crm";
import { StatCard, PageHeader, Card, Spinner, StatusBadge, Th, Td } from "@/components/crm/ui";
import { formatAED, formatDate, REFERRAL_STATUSES, referralLinkOf } from "@/lib/format";

export default function PartnerDashboard() {
  const { partner } = useOutletContext();
  const partnerFilter = { partner_id: partner.id };
  const totalReferrals = useCount("Referral", partnerFilter);
  const successful = useCount("Referral", { ...partnerFilter, status: { $in: ["treatment_completed", "satisfaction_confirmed", "commission_pending", "commission_payable", "paid"] } });
  const balRows = useAggregate("Commission", { query: partnerFilter, groupBy: "status", sum: "commission_amount" });
  const { items: recent, loading } = useCollection("Referral", partnerFilter, { sort: "-created_date", limit: 5 });
  const [copied, setCopied] = useState(false);

  const bal = (st) => balRows.find((r) => r.status === st)?.sum_commission_amount || 0;
  const totalEarned = bal("paid") + bal("payable");
  const pending = bal("pending") + bal("approved");
  const payable = bal("payable");
  const paid = bal("paid");

  const copyLink = () => { navigator.clipboard.writeText(referralLinkOf(partner)); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div>
      <PageHeader title={`Welcome, ${partner.contact_person || partner.business_name}`} subtitle="Your referral performance at a glance" />

      <Card className="p-5 mb-6 bg-gradient-to-br from-brand-soft/40 to-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Your Referral Link</p>
            <code className="text-sm font-medium bg-card px-3 py-2 rounded-lg block mt-1.5 break-all border border-border">{referralLinkOf(partner)}</code>
            <p className="text-xs text-muted-foreground mt-1.5">Code: <span className="font-medium text-foreground">{partner.referral_code}</span></p>
          </div>
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand text-primary-foreground text-sm font-medium hover:bg-brand-dark transition-colors shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Referrals" value={totalReferrals ?? "—"} sublabel={`${successful ?? 0} successful`} icon={Share2} />
        <StatCard label="Total Earned" value={formatAED(totalEarned)} icon={TrendingUp} tone="brand" />
        <StatCard label="Available Balance" value={formatAED(payable)} sublabel="ready for payout" icon={Wallet} tone="soft" />
        <StatCard label="Pending" value={formatAED(pending)} sublabel="awaiting validation" icon={Wallet} tone="neutral" />
        <StatCard label="Paid" value={formatAED(paid)} icon={Wallet} tone="neutral" />
        <StatCard label="Conversion" value={totalReferrals ? `${Math.round((successful / totalReferrals) * 100)}%` : "—"} icon={TrendingUp} tone="neutral" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Referrals</h3>
          <Link to="/portal/referrals" className="text-xs text-brand hover:underline flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
        {loading ? <Spinner /> : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No referrals yet. Share your link to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Client</Th><Th>Service</Th><Th>Status</Th><Th className="text-right">Commission</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {recent.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{r.client_name}</Td>
                    <Td className="text-muted-foreground">{r.service_name || r.service_category || "—"}</Td>
                    <Td><StatusBadge status={r.status} map={REFERRAL_STATUSES} /></Td>
                    <Td className="text-right">{r.gross_amount ? formatAED(r.gross_amount) : "—"}</Td>
                    <Td className="text-muted-foreground">{formatDate(r.created_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}