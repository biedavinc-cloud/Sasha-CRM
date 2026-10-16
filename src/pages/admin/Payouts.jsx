import React, { useState, useEffect } from "react";
import { notifyError } from "@/lib/notify";
import { Plus, Wallet, Check } from "lucide-react";
import { api } from "@/api/client";
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
  const { items: payouts, loading, reload } = useCollection("Payout", {}, { sort: "-created_date", limit: 2000 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 2000, fields: ["business_name", "user_id", "phone"] });
  const { items: settingsRows } = useCollection("ClinicSetting", { setting_key: "default" }, { limit: 1 });
  const settings = settingsRows[0] || {};
  const phoneById = Object.fromEntries(partners.map((p) => [p.id, p.phone]));
  // WhatsApp click-to-chat: opens a ready-to-send message (uses the template from Settings)
  const waLink = (p) => {
    const phone = String(phoneById[p.partner_id] || "").replace(/[^0-9]/g, "");
    if (!phone) return null;
    const tpl = settings.whatsapp_template || "Hi {partner}, a payout of AED {amount} has been sent. Reference: {reference}";
    const text = tpl.replace(/\{partner\}/g, p.partner_name || "").replace(/\{amount\}/g, String(p.amount)).replace(/\{reference\}/g, p.payment_reference || "");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };
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
    api.entities.Commission.filter({ partner_id: selectedPartner, status: "payable" }, { limit: 500 })
      .then((r) => { setPayable(r.items || []); setSelected([]); })
      .catch(() => setPayable([]));
  }, [selectedPartner]);

  const total = payable.filter((c) => selected.includes(c.id)).reduce((s, c) => s + (c.commission_amount || 0), 0);

  const handleCreate = async () => {
    if (!selectedPartner || !selected.length) return;
    setSaving(true);
    try {
      await api.functions.invoke("createPayout", { partnerId: selectedPartner, commissionIds: selected, notes });
      setCreateOpen(false); setSelectedPartner(""); setSelected([]); setNotes(""); reload();
    } catch (e) { notifyError(e.response?.data?.error || e.message); } finally { setSaving(false); }
  };

  const markPaid = async () => {
    setSaving(true);
    try {
      await api.entities.Payout.update(payOpen.id, { status: "paid", payment_reference: ref, payment_date: new Date().toISOString() });
      setPayOpen(null); setRef(""); reload();
    } catch (e) { notifyError(e.message); } finally { setSaving(false); }
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
                    <Td><div className="flex gap-2">{(p.status === "pending" || p.status === "processing") && <Button variant="outline" size="sm" onClick={() => { setPayOpen(p); setRef(p.payment_reference || ""); }}>Mark Paid</Button>}{p.status === "paid" && settings.notify_whatsapp_on_payout && waLink(p) && <a href={waLink(p)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center rounded-md border border-input px-3 h-9 text-xs font-medium hover:bg-muted">WhatsApp</a>}</div></Td>
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
            <div><Label htmlFor="f-partner-1">Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}><SelectTrigger id="f-partner-1"><SelectValue placeholder="Select partner" /></SelectTrigger><SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select>
            </div>
            {selectedPartner && payable.length > 0 && (
              <button type="button" className="text-xs font-medium text-brand hover:underline" onClick={() => setSelected(selected.length === payable.length ? [] : payable.map((c) => c.id))}>{selected.length === payable.length ? "Clear selection" : "Select all"}</button>
            )}
            {selectedPartner && (
              payable.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No payable commissions for this partner.</p> : (
                <div className="max-h-56 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {payable.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 cursor-pointer">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => setSelected((s) => s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id])} className="h-4 w-4 accent-[hsl(var(--brand))]" />
                      <div className="flex-1 text-sm"><p>{c.client_name || c.commission_id}</p><p className="text-xs text-muted-foreground">{formatDate(c.created_date)}</p></div>
                      <span className="font-medium">{formatAED(c.commission_amount)}</span>
                    </label>
                  ))}
                </div>
              )
            )}
            {selected.length > 0 && <div className="flex justify-between items-center bg-brand-soft/30 rounded-xl p-3"><span className="text-sm font-medium">Total Payout</span><span className="text-lg font-semibold text-brand-dark">{formatAED(total)}</span></div>}
            <div><Label htmlFor="f-notes-2">Notes</Label><Textarea id="f-notes-2" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !selected.length} className="bg-brand hover:bg-brand-dark">{saving ? "Creating…" : "Create Payout"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark Payout as Paid</DialogTitle></DialogHeader>
          {payOpen && <p className="text-sm text-muted-foreground">{payOpen.partner_name} · {formatAED(payOpen.amount)}</p>}
          <div><Label htmlFor="f-payment-reference-3">Payment Reference</Label><Input id="f-payment-reference-3" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Bank transfer ref / cheque no." /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button><Button onClick={markPaid} disabled={saving || !ref.trim()} className="bg-emerald-600 hover:bg-emerald-700"><Check className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Confirm Paid"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}