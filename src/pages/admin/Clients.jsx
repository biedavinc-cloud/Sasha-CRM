import React, { useState } from "react";
import { Plus, Users, Search } from "lucide-react";
import { api } from "@/api/client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { LEAD_STATUSES, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const empty = { full_name: "", phone: "", email: "", source: "walk_in", partner_id: "", notes: "", customer_status: "lead" };

export default function Clients() {
  const { items: clients, loading, reload } = useCollection("Client", {}, { sort: "-created_date", limit: 200 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 100, fields: ["business_name"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = clients.filter((c) => (c.full_name || "").toLowerCase().includes(search.toLowerCase()) || (c.phone || "").includes(search));

  const handleCreate = async () => {
    if (!form.full_name || !form.phone) return;
    setSaving(true);
    try {
      const partner = partners.find((p) => p.id === form.partner_id);
      await api.entities.Client.create({ ...form, client_id: "CL-" + Date.now().toString().slice(-6), partner_name: partner?.business_name || "" });
      setOpen(false); setForm(empty); reload();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  const updateStatus = async (c, status) => { await api.entities.Client.update(c.id, { lead_status: status }); reload(); };

  return (
    <div>
      <PageHeader title="Clients" subtitle="Clinic client database" actions={<Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Client</Button>} />
      <div className="relative mb-4 max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No clients yet" description="Add clients manually or they appear automatically from partner referrals." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Name</Th><Th>Phone</Th><Th>Source</Th><Th>Partner</Th><Th>Status</Th><Th>Created</Th><Th></Th></tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{c.full_name}<p className="text-xs text-muted-foreground">{c.email}</p></Td>
                    <Td>{c.phone}</Td>
                    <Td className="capitalize">{(c.source || "").replace(/_/g, " ")}</Td>
                    <Td>{c.partner_name || "—"}</Td>
                    <Td><StatusBadge status={c.lead_status} map={LEAD_STATUSES} /></Td>
                    <Td className="text-muted-foreground">{formatDate(c.created_date)}</Td>
                    <Td>
                      <Select value={c.lead_status} onValueChange={(v) => updateStatus(c, v)}>
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
          <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
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
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !form.full_name || !form.phone} className="bg-brand hover:bg-brand-dark">{saving ? "Saving…" : "Add Client"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}