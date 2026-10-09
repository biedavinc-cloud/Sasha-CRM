import React from "react";
import { Link } from "react-router-dom";
import { Handshake, Share2, TrendingUp, Wallet, ArrowUpRight, Percent } from "lucide-react";
import { useCount, useCollection, useAggregate } from "@/hooks/crm";
import { StatCard, PageHeader, Card, Spinner, Th, Td, StatusBadge } from "@/components/crm/ui";
import { formatAED, formatDate, REFERRAL_STATUSES } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Dashboard() {
  const totalPartners = useCount("Partner", {});
  const activePartners = useCount("Partner", { status: "active" });
  const totalReferrals = useCount("Referral", {});
  const successfulReferrals = useCount("Referral", { status: { $in: ["treatment_completed", "satisfaction_confirmed", "commission_pending", "commission_payable", "paid"] } });

  const commissionRows = useAggregate("Commission", { groupBy: "status", sum: "commission_amount" });
  const topPartners = useAggregate("Referral", { groupBy: "partner_name", count: true, sum: "gross_amount", sort: "-count", limit: 5 });
  const { items: recentReferrals, loading } = useCollection("Referral", {}, { sort: "-created_date", limit: 6 });

  const commByStatus = (status) => commissionRows.find((r) => r.status === status)?.sum_commission_amount || 0;
  const totalCommission = commissionRows.reduce((s, r) => s + (r.sum_commission_amount || 0), 0);
  const pendingCommission = commByStatus("pending") + commByStatus("approved");
  const payableCommission = commByStatus("payable");
  const paidCommission = commByStatus("paid");
  const conversionRate = totalReferrals ? Math.round((successfulReferrals / totalReferrals) * 100) : 0;

  const chartData = [
    { name: "Pending", value: commByStatus("pending"), fill: "hsl(var(--chart-4))" },
    { name: "Payable", value: payableCommission, fill: "hsl(var(--chart-1))" },
    { name: "Paid", value: paidCommission, fill: "hsl(var(--chart-2))" },
    { name: "Held", value: commByStatus("held"), fill: "hsl(var(--chart-5))" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Referral performance & financial overview" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Partners" value={totalPartners ?? "—"} sublabel={`${activePartners ?? 0} active`} icon={Handshake} />
        <StatCard label="Total Referrals" value={totalReferrals ?? "—"} sublabel={`${successfulReferrals ?? 0} successful`} icon={Share2} />
        <StatCard label="Conversion Rate" value={`${conversionRate}%`} sublabel="referred → completed" icon={TrendingUp} />
        <StatCard label="Total Commission" value={formatAED(totalCommission)} sublabel="all statuses" icon={Percent} tone="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending" value={formatAED(pendingCommission)} sublabel="awaiting validation" icon={Wallet} tone="neutral" />
        <StatCard label="Payable" value={formatAED(payableCommission)} sublabel="ready for payout" icon={Wallet} tone="brand" />
        <StatCard label="Paid" value={formatAED(paidCommission)} sublabel="settled to partners" icon={Wallet} tone="soft" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Commission by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} formatter={(v) => formatAED(v)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Top Partners by Referrals</h3>
          {topPartners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No referral data yet.</p>
          ) : (
            <div className="space-y-3">
              {topPartners.map((r, i) => (
                <div key={r.partner_name} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-brand-soft/40 flex items-center justify-center text-xs font-semibold text-brand-dark">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.partner_name}</p>
                    <p className="text-xs text-muted-foreground">{r.count} referrals · {formatAED(r.sum_gross_amount || 0)} revenue</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent Referrals</h3>
          <Link to="/admin/referrals" className="text-xs text-brand hover:underline flex items-center gap-1">View all <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
        {loading ? <Spinner /> : recentReferrals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No referrals yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Client</Th>
                  <Th>Partner</Th>
                  <Th>Service</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentReferrals.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{r.client_name}</Td>
                    <Td>{r.partner_name}</Td>
                    <Td>{r.service_name || r.service_category || "—"}</Td>
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