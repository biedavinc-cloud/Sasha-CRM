import React, { useState } from "react";
import { Plus, UserPlus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { LEAD_STATUSES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const empty = { full_name: "", phone: "", email: "", source: "partner_referral", partner_id: "", service_interest: "", status: "new", notes: "" };

export default function Leads() {
  const { items: leads, loading, reload } = useCollection("Lead", {}, { sort: "-created_date", limit: 200 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 100, fields: ["business_name"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = leads.filter((l) => (l.full_name || "").toLowerCase().includes(search.toLowerCase()) || (l.phone || "").includes(search));

  const handleCreate = async () => {
    if (!form.full_name || !form.phone) return;
    setSaving(true);
    try {
      const partner = partners.find((p) => p.id === form.partner_id);
      await base44.entities.Lead.create({ ...form, lead_id: "L-" + Date.now().toString().slice(-6), partner_name: partner?.business_name || "" });
      setOpen(false); setForm(empty); reload();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const updateStatus = async (l, status) => { await base44.entities.Lead.update(l.id, { status }); reload(); };

  return (
    <div>
      <PageHeader title="Leads" subtitle="Incoming leads and their referral source" actions={<Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Lead</Button>} />
      <div className="relative mb-4 max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search leads…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={UserPlus} title="No leads yet" description="Leads from partner referrals and other sources appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Lead</Th><Th>Phone</Th><Th>Source</Th><Th>Partner</Th><Th>Interest</Th><Th>Status</Th><Th></Th></tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{l.full_name}<p className="text-xs text-muted-foreground">{l.email}</p></Td>
                    <Td>{l.phone}</Td>
                    <Td className="capitalize">{(l.source || "").replace(/_/g, " ")}</Td>
                    <Td>{l.partner_name ? <span className="text-brand">{l.partner_name}</span> : "—"}</Td>
                    <Td className="text-muted-foreground">{l.service_interest || "—"}</Td>
                    <Td><StatusBadge status={l.status} map={LEAD_STATUSES} /></Td>
                    <Td>
                      <Select value={l.status} onValueChange={(v) => updateStatus(l, v)}>
                        <SelectTrigger className="h-8 w-32 text-xs border-0 bg-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(LEAD_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Source</Label><Select value={form.source} onValueChange={(v) => set("source", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="partner_referral">Partner Referral</SelectItem><SelectItem value="walk_in">Walk-in</SelectItem><SelectItem value="social_media">Social Media</SelectItem><SelectItem value="website">Website</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
              <div><Label>Referral Partner</Label><Select value={form.partner_id} onValueChange={(v) => set("partner_id", v)}><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value={null}>None</SelectItem>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Service Interest</Label><Input value={form.service_interest} onChange={(e) => set("service_interest", e.target.value)} placeholder="e.g. PRP Hair" /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !form.full_name || !form.phone} className="bg-brand hover:bg-brand-dark">{saving ? "Saving…" : "Add Lead"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}