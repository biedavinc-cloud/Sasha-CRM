import React, { useMemo } from "react";
import { FileBarChart, Download, Users, Percent, Wallet, Share2, Sparkles, Calendar } from "lucide-react";
import { useCollection, useAggregate } from "@/hooks/crm";
import { PageHeader, Card, Spinner, Th, Td, StatusBadge, EmptyState } from "@/components/crm/ui";
import { exportToCSV } from "@/lib/csv";
import { formatAED, formatDate, COMMISSION_STATUSES, PAYOUT_STATUSES, REFERRAL_STATUSES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Reports() {
  const { items: commissions, loading: lc } = useCollection("Commission", {}, { sort: "-created_date", limit: 2000 });
  const { items: payouts, loading: lp } = useCollection("Payout", {}, { sort: "-created_date", limit: 2000 });
  const { items: referrals, loading: lr } = useCollection("Referral", {}, { sort: "-created_date", limit: 2000 });
  const partnerPerf = useAggregate("Referral", { groupBy: "partner_name", count: true, sum: "gross_amount", sort: "-count", limit: 100 });
  const servicePerf = useAggregate("Referral", { groupBy: "service_name", count: true, sum: "gross_amount", sort: "-sum_gross_amount", limit: 100 });

  const monthly = useMemo(() => {
    const map = {};
    referrals.forEach((r) => {
      const d = new Date(r.created_date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { month: key, referrals: 0, revenue: 0 };
      map[key].referrals += 1;
      map[key].revenue += Number(r.gross_amount) || 0;
    });
    return Object.values(map).sort((a, b) => b.month.localeCompare(a.month));
  }, [referrals]);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Export partner, commission, payout & performance reports" />

      <Tabs defaultValue="partners">
        <TabsList className="mb-4 flex flex-wrap h-auto">
          <TabsTrigger value="partners"><Users className="h-3.5 w-3.5 mr-1.5" />Partner Performance</TabsTrigger>
          <TabsTrigger value="commissions"><Percent className="h-3.5 w-3.5 mr-1.5" />Commissions</TabsTrigger>
          <TabsTrigger value="payouts"><Wallet className="h-3.5 w-3.5 mr-1.5" />Payouts</TabsTrigger>
          <TabsTrigger value="referrals"><Share2 className="h-3.5 w-3.5 mr-1.5" />Referrals</TabsTrigger>
          <TabsTrigger value="services"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Services</TabsTrigger>
          <TabsTrigger value="monthly"><Calendar className="h-3.5 w-3.5 mr-1.5" />Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <ReportCard title="Partner Performance" icon={Users} loading={false} rows={partnerPerf} onExport={() => exportToCSV("partner-performance.csv", [
            { label: "Partner", key: "partner_name" },
            { label: "Referrals", key: "count" },
            { label: "Revenue (AED)", value: (r) => r.sum_gross_amount || 0 },
          ], partnerPerf)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Partner</Th><Th className="text-right">Referrals</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {partnerPerf.map((r) => (
                  <tr key={r.partner_name} className="hover:bg-muted/30"><Td className="font-medium">{r.partner_name}</Td><Td className="text-right">{r.count}</Td><Td className="text-right">{formatAED(r.sum_gross_amount)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="commissions">
          <ReportCard title="Commission Report" icon={Percent} loading={lc} rows={commissions} onExport={() => exportToCSV("commissions.csv", [
            { label: "Commission ID", key: "commission_id" },
            { label: "Partner", key: "partner_name" },
            { label: "Service", key: "service_name" },
            { label: "Basis", key: "basis" },
            { label: "Gross (AED)", key: "gross_amount" },
            { label: "Eligible (AED)", key: "eligible_amount" },
            { label: "Rate %", key: "commission_rate" },
            { label: "Commission (AED)", key: "commission_amount" },
            { label: "Status", key: "status" },
            { label: "Approved By", key: "approved_by" },
            { label: "Date", value: (r) => formatDate(r.created_date) },
          ], commissions)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Partner</Th><Th>Service</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30"><Td className="font-medium">{c.partner_name}</Td><Td className="text-muted-foreground">{c.client_name || c.service_name}</Td><Td className="text-right">{formatAED(c.commission_amount)}</Td><Td><StatusBadge status={c.status} map={COMMISSION_STATUSES} /></Td><Td className="text-muted-foreground">{formatDate(c.created_date)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="payouts">
          <ReportCard title="Payout Report" icon={Wallet} loading={lp} rows={payouts} onExport={() => exportToCSV("payouts.csv", [
            { label: "Payout ID", key: "payout_id" },
            { label: "Partner", key: "partner_name" },
            { label: "Amount (AED)", key: "amount" },
            { label: "Status", key: "status" },
            { label: "Reference", key: "payment_reference" },
            { label: "Date", value: (r) => formatDate(r.payment_date || r.created_date) },
          ], payouts)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Payout ID</Th><Th>Partner</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30"><Td className="font-mono text-xs">{p.payout_id}</Td><Td className="font-medium">{p.partner_name}</Td><Td className="text-right">{formatAED(p.amount)}</Td><Td><StatusBadge status={p.status} map={PAYOUT_STATUSES} /></Td><Td className="text-muted-foreground">{formatDate(p.payment_date || p.created_date)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="referrals">
          <ReportCard title="Referral Performance" icon={Share2} loading={lr} rows={referrals} onExport={() => exportToCSV("referrals.csv", [
            { label: "Referral ID", key: "referral_id" },
            { label: "Partner", key: "partner_name" },
            { label: "Client", key: "client_name" },
            { label: "Phone", key: "client_phone" },
            { label: "Service", key: "service_name" },
            { label: "Status", key: "status" },
            { label: "Gross (AED)", key: "gross_amount" },
            { label: "Fraud Flag", value: (r) => (r.fraud_flag ? "Yes" : "No") },
            { label: "Date", value: (r) => formatDate(r.created_date) },
          ], referrals)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Referral ID</Th><Th>Client</Th><Th>Partner</Th><Th>Status</Th><Th className="text-right">Gross</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30"><Td className="font-mono text-xs text-muted-foreground">{r.referral_id}</Td><Td className="font-medium">{r.client_name}</Td><Td>{r.partner_name}</Td><Td><StatusBadge status={r.status} map={REFERRAL_STATUSES} /></Td><Td className="text-right">{r.gross_amount ? formatAED(r.gross_amount) : "—"}</Td><Td className="text-muted-foreground">{formatDate(r.created_date)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="services">
          <ReportCard title="Service Performance" icon={Sparkles} loading={false} rows={servicePerf} onExport={() => exportToCSV("service-performance.csv", [
            { label: "Service", key: "service_name" },
            { label: "Referrals", key: "count" },
            { label: "Revenue (AED)", value: (r) => r.sum_gross_amount || 0 },
          ], servicePerf)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Service</Th><Th className="text-right">Referrals</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {servicePerf.map((r) => (
                  <tr key={r.service_name} className="hover:bg-muted/30"><Td className="font-medium">{r.service_name || "—"}</Td><Td className="text-right">{r.count}</Td><Td className="text-right">{formatAED(r.sum_gross_amount)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>

        <TabsContent value="monthly">
          <ReportCard title="Monthly Referral Performance" icon={Calendar} loading={lr} rows={monthly} onExport={() => exportToCSV("monthly-referrals.csv", [
            { label: "Month", key: "month" },
            { label: "Referrals", key: "referrals" },
            { label: "Revenue (AED)", key: "revenue" },
          ], monthly)}>
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Month</Th><Th className="text-right">Referrals</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {monthly.map((r) => (
                  <tr key={r.month} className="hover:bg-muted/30"><Td className="font-medium">{r.month}</Td><Td className="text-right">{r.referrals}</Td><Td className="text-right">{formatAED(r.revenue)}</Td></tr>
                ))}
              </tbody>
            </table>
          </ReportCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportCard({ title, icon: Icon, loading, rows, onExport, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">{title}</h3><span className="text-xs text-muted-foreground">({rows.length})</span></div>
        <Button variant="outline" size="sm" onClick={onExport} disabled={!rows.length}><Download className="h-3.5 w-3.5 mr-1.5" />Export CSV</Button>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <EmptyState icon={FileBarChart} title="No data for this report yet" /> : <div className="overflow-x-auto">{children}</div>}
    </Card>
  );
}