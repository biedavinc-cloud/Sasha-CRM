import React from "react";
import { useOutletContext } from "react-router-dom";
import { Percent } from "lucide-react";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { COMMISSION_STATUSES, formatAED, formatDate } from "@/lib/format";

export default function MyCommissions() {
  const { partner } = useOutletContext();
  const { items: commissions, loading } = useCollection("Commission", { partner_id: partner.id }, { sort: "-created_date", limit: 2000 });

  return (
    <div>
      <PageHeader title="My Commissions" subtitle="How your balance was calculated" />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : commissions.length === 0 ? (
          <EmptyState icon={Percent} title="No commissions yet" description="Commissions appear here once referrals complete treatment and are validated by Sasha." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Commission ID</Th><Th>Client</Th><Th>Basis</Th><Th className="text-right">Eligible</Th><Th className="text-right">Rate</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Paid Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <Td className="font-mono text-xs text-muted-foreground">{c.commission_id}</Td>
                    <Td className="font-medium">{c.client_name || c.service_name || "—"}</Td>
                    <Td className="capitalize">{c.basis}</Td>
                    <Td className="text-right">{formatAED(c.eligible_amount)}</Td>
                    <Td className="text-right">{c.commission_rate}%</Td>
                    <Td className="text-right font-medium">{formatAED(c.commission_amount)}</Td>
                    <Td><StatusBadge status={c.status} map={COMMISSION_STATUSES} /></Td>
                    <Td className="text-muted-foreground">{c.paid_date ? formatDate(c.paid_date) : "—"}</Td>
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