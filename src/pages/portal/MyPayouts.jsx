import React from "react";
import { useOutletContext } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { PAYOUT_STATUSES, formatAED, formatDate } from "@/lib/format";

export default function MyPayouts() {
  const { partner } = useOutletContext();
  const { items: payouts, loading } = useCollection("Payout", { partner_id: partner.id }, { sort: "-created_date", limit: 100 });

  return (
    <div>
      <PageHeader title="My Payouts" subtitle="Payments received from Sasha Aesthetic Clinic" />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : payouts.length === 0 ? (
          <EmptyState icon={Wallet} title="No payouts yet" description="When Sasha processes your payout, it appears here with the payment reference." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Payout ID</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Reference</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <Td className="font-mono text-xs">{p.payout_id}</Td>
                    <Td className="text-right font-medium">{formatAED(p.amount)}</Td>
                    <Td><StatusBadge status={p.status} map={PAYOUT_STATUSES} /></Td>
                    <Td className="text-muted-foreground">{p.payment_reference || "—"}</Td>
                    <Td className="text-muted-foreground">{formatDate(p.payment_date || p.created_date)}</Td>
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