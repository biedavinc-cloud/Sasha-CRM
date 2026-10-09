import React, { useState, useEffect } from "react";
import { Plus, Wallet, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { PAYOUT_STATUSES, formatAED, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Payouts() {
  const { items: payouts, loading, reload } = useCollection("Payout", {}, { sort: "-created_date", limit: 200 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 100, fields: ["business_name", "user_id"] });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState("");
  const [payable, setPayable] = useState([]);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [ref, setRef] = useState("");

  useEffect(() => {
    if (!selectedPartner) { setPayable([]); return; }
    base44.entities.Commission.filter({ partner_id: selectedPartner, status: "payable" }, { limit: 100 })
      .then((r) => { setPayable(r.items || []); setSelected([]); })
      .catch(() => setPayable([]));
  }, [selectedPartner]);

  const total = payable.filter((c) => selected.includes(c.id)).reduce((s, c) => s + (c.commission_amount || 0), 0);

  const handleCreate = async () => {
    if (!selectedPartner || !selected.length) return;
    setSaving(true);
    try {
      await base44.functions.invoke("createPayout", { partnerId: selectedPartner, commissionIds: selected, notes });
      setCreateOpen(false); setSelectedPartner(""); setSelected([]); setNotes(""); reload();
    } catch (e) { alert(e.response?.data?.error || e.message); } finally { setSaving(false); }
  };

  const markPaid = async () => {
    setSaving(true);
    try {
      await base44.entities.Payout.update(payOpen.id, { status: "paid", payment_reference: ref, payment_date: new Date().toISOString() });
      setPayOpen(null); setRef(""); reload();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Payouts" subtitle="Process partner commission payouts" actions={<Button onClick={() => setCreateOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Payout</Button>} />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : payouts.length === 0 ? (
          <EmptyState icon={Wallet} title="No payouts yet" description="Create a payout from approved (payable) commissions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Payout ID</Th><Th>Partner</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Reference</Th><Th>Date</Th><Th></Th></tr></thead>
              <tbody className="divide-y divide-border">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{p.payout_id}</Td>
                    <Td>{p.partner_name}</Td>
                    <Td className="text-right font-medium">{formatAED(p.amount)}</Td>
                    <Td><StatusBadge status={p.status} map={PAYOUT_STATUSES} /></Td>
                    <Td className="text-muted-foreground">{p.payment_reference || "—"}</Td>
                    <Td className="text-muted-foreground">{formatDate(p.payment_date || p.created_date)}</Td>
                    <Td>{(p.status === "pending" || p.status === "processing") && <Button variant="outline" size="sm" onClick={() => { setPayOpen(p); setRef(p.payment_reference || ""); }}>Mark Paid</Button>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Payout</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}><SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger><SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select>
            </div>
            {selectedPartner && (
              payable.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No payable commissions for this partner.</p> : (
                <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {payable.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} className="h-4 w-4 accent-[hsl(var(--brand))]" />
                      <div className="flex-1 text-sm"><p>{c.service_name}</p><p className="text-xs text-muted-foreground">{formatDate(c.created_date)}</p></div>
                      <span className="font-medium">{formatAED(c.commission_amount)}</span>
                    </label>
                  ))}
                </div>
              )
            )}
            {selected.length > 0 && <div className="flex justify-between items-center bg-brand-soft/30 rounded-xl p-3"><span className="text-sm font-medium">Total Payout</span><span className="text-lg font-semibold text-brand-dark">{formatAED(total)}</span></div>}
            <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !selected.length} className="bg-brand hover:bg-brand-dark">{saving ? "Creating…" : "Create Payout"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Payout as Paid</DialogTitle></DialogHeader>
          {payOpen && <p className="text-sm text-muted-foreground">{payOpen.partner_name} · {formatAED(payOpen.amount)}</p>}
          <div><Label>Payment Reference</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank transfer ref / cheque no." /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button><Button onClick={markPaid} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Confirm Paid"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}