import React, { useState } from "react";
import { notifyError } from "@/lib/notify";
import { Percent, Search } from "lucide-react";
import { api } from "@/api/client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { COMMISSION_STATUSES, formatAED, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Commissions() {
  const { items: commissions, loading, reload } = useCollection("Commission", {}, { sort: "-created_date", limit: 2000 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [review, setReview] = useState(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const filtered = commissions.filter((c) =>
    (statusFilter === "all" || c.status === statusFilter) &&
    ((c.partner_name || "").toLowerCase().includes(search.toLowerCase()) || (c.client_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const doAction = async (action) => {
    setActing(true);
    try {
      await api.functions.invoke("approveCommission", { commissionId: review.id, action, notes });
      setReview(null); setNotes(""); reload();
    } catch (e) { notifyError(e.response?.data?.error || e.message); } finally { setActing(false); }
  };

  const doRefund = async () => {
    if (!confirm("Refund this commission? This will reverse the commission and mark the referral as refunded.")) return;
    setActing(true);
    try {
      await api.functions.invoke("refundCommission", { commissionId: review.id, reason: notes });
      setReview(null); setNotes(""); reload();
    } catch (e) { notifyError(e.response?.data?.error || e.message); } finally { setActing(false); }
  };

  return (
    <div>
      <PageHeader title="Commissions" subtitle="Validate, approve & manage partner commissions" />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search partner or client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(COMMISSION_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Percent} title="No commissions yet" description="Commissions are generated when referrals complete the validation flow." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr><Th>Partner</Th><Th>Client</Th><Th>Basis</Th><Th className="text-right">Eligible</Th><Th className="text-right">Rate</Th><Th className="text-right">Commission</Th><Th>Status</Th><Th></Th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{c.partner_name}</Td>
                    <Td className="text-muted-foreground">{c.client_name || c.service_name || "—"}</Td>
                    <Td className="capitalize">{c.basis}</Td>
                    <Td className="text-right">{formatAED(c.eligible_amount)}</Td>
                    <Td className="text-right">{c.commission_rate}%</Td>
                    <Td className="text-right font-medium">{formatAED(c.commission_amount)}</Td>
                    <Td><StatusBadge status={c.status} map={COMMISSION_STATUSES} /></Td>
                    <Td><Button variant="outline" size="sm" onClick={() => { setReview(c); setNotes(c.adjustment_notes || ""); }}>Review</Button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Review Commission</DialogTitle></DialogHeader>
          {review && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Partner</span><span className="font-medium">{review.partner_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="font-medium">{review.client_name || review.service_name || "--"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Basis</span><span className="font-medium capitalize">{review.basis}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Gross Amount</span><span>{formatAED(review.gross_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Eligible Amount</span><span>{formatAED(review.eligible_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span>{review.commission_rate}%</span></div>
                <div className="flex justify-between border-t border-border pt-1.5"><span className="font-medium">Commission</span><span className="font-semibold text-brand">{formatAED(review.commission_amount)}</span></div>
                {review.approved_by && <div className="flex justify-between text-xs text-muted-foreground"><span>Reviewed by</span><span>{review.approved_by} · {formatDateTime(review.approved_date)}</span></div>}
              </div>
              <div><Label htmlFor="f-internal-notes-1">Internal Notes</Label><Textarea id="f-internal-notes-1" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Adjustment reason, dispute details…" /></div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => doAction("approve")} disabled={acting} className="bg-emerald-600 hover:bg-emerald-700 flex-1">Approve</Button>
                <Button onClick={() => doAction("hold")} disabled={acting} variant="outline" className="flex-1">Hold</Button>
                <Button onClick={() => doAction("dispute")} disabled={acting} variant="outline" className="flex-1">Dispute</Button>
                <Button onClick={() => doAction("reject")} disabled={acting} variant="outline" className="text-destructive hover:text-destructive flex-1">Reject</Button>
              </div>
              <div className="border-t border-border pt-3 mt-1">
                <Button onClick={doRefund} disabled={acting} variant="outline" className="w-full text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
                  Refund / Reverse Commission
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}