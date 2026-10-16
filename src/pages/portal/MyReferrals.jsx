import React from "react";
import { useOutletContext } from "react-router-dom";
import { Share2 } from "lucide-react";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { REFERRAL_STATUSES, formatDate, formatAED } from "@/lib/format";

export default function MyReferrals() {
  const { partner } = useOutletContext();
  const { items: referrals, loading } = useCollection("Referral", { partner_id: partner.id }, { sort: "-created_date", limit: 2000 });
  const { items: comms } = useCollection("Commission", { partner_id: partner.id }, { limit: 500 });
  const commByReferral = Object.fromEntries(comms.map((c) => [c.referral_id, c.commission_amount]));

  return (
    <div>
      <PageHeader title="My Referrals" subtitle="Referrals attributed to your partner link" />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : referrals.length === 0 ? (
          <EmptyState icon={Share2} title="No referrals yet" description="Share your referral link with clients. When they book with Sasha, referrals appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Referral ID</Th><Th>Client</Th><Th>Service</Th><Th>Status</Th><Th className="text-right">Commission</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <Td className="font-mono text-xs text-muted-foreground">{r.referral_id}</Td>
                    <Td className="font-medium">{r.client_name}</Td>
                    <Td className="text-muted-foreground">{r.service_name || r.service_category || "—"}</Td>
                    <Td><StatusBadge status={r.status} map={REFERRAL_STATUSES} /></Td>
                    <Td className="text-right">{commByReferral[r.id] != null ? formatAED(commByReferral[r.id]) : "—"}</Td>
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