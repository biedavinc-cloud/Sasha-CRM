import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Handshake, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { PARTNER_STATUSES, PARTNER_TYPES, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const empty = { business_name: "", partner_type: "hair_salon", contact_person: "", email: "", phone: "", address: "", status: "pending", commission_percentage: 10, commission_basis: "gross", attribution_window_days: 30, contract_notes: "" };

export default function Partners() {
  const { items: partners, loading, reload } = useCollection("Partner", {}, { sort: "-created_date", limit: 200 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = partners.filter((p) => (p.business_name || "").toLowerCase().includes(search.toLowerCase()) || (p.referral_code || "").toLowerCase().includes(search.toLowerCase()));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.business_name) return;
    setSaving(true);
    try {
      let userId = "";
      if (form.email) {
        try { const res = await base44.users.inviteUser(form.email, "user"); userId = res?.id || res?.data?.id || ""; } catch (e) { /* may already exist */ }
      }
      const code = "SASHA-" + form.business_name.toUpperCase().replace(/[^A-Z0-9]/g, "");
      await base44.entities.Partner.create({
        ...form,
        partner_id: "P-" + Date.now().toString().slice(-6),
        referral_code: code,
        referral_link: `${window.location.origin}/r/${code}`,
        user_id: userId,
        commission_percentage: Number(form.commission_percentage) || 10,
        attribution_window_days: Number(form.attribution_window_days) || 30,
      });
      setOpen(false);
      setForm(empty);
      reload();
    } catch (e) {
      alert(e.message || "Failed to create partner");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (p, status) => {
    await base44.entities.Partner.update(p.id, { status });
    reload();
  };

  return (
    <div>
      <PageHeader title="Partners" subtitle="Manage referral partner businesses" actions={
        <Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Partner</Button>
      } />

      <div className="relative mb-4 max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by name or referral code…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Handshake} title="No partners yet" description="Create your first referral partner to generate their unique referral code and link." action={<Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Partner</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Business</Th>
                  <Th>Type</Th>
                  <Th>Referral Code</Th>
                  <Th>Commission</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <Td>
                      <Link to={`/admin/partners/${p.id}`} className="font-medium hover:text-brand">{p.business_name}</Link>
                      <p className="text-xs text-muted-foreground">{p.contact_person || p.email}</p>
                    </Td>
                    <Td className="text-muted-foreground">{PARTNER_TYPES[p.partner_type] || p.partner_type}</Td>
                    <Td><code className="text-xs bg-muted px-2 py-1 rounded-md">{p.referral_code}</code></Td>
                    <Td>{p.commission_percentage}% <span className="text-xs text-muted-foreground">({p.commission_basis})</span></Td>
                    <Td><StatusBadge status={p.status} map={PARTNER_STATUSES} /></Td>
                    <Td className="text-muted-foreground">{formatDate(p.created_date)}</Td>
                    <Td>
                      <Select value={p.status} onValueChange={(v) => changeStatus(p, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs border-0 bg-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activate</SelectItem>
                          <SelectItem value="suspended">Suspend</SelectItem>
                          <SelectItem value="inactive">Deactivate</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Business Name *</Label><Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} placeholder="Beauty Lounge JVC" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Partner Type</Label>
                <Select value={form.partner_type} onValueChange={(v) => set("partner_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PARTNER_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PARTNER_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email (for portal invite)</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="partner@example.com" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Commission %</Label><Input type="number" value={form.commission_percentage} onChange={(e) => set("commission_percentage", e.target.value)} /></div>
              <div><Label>Basis</Label>
                <Select value={form.commission_basis} onValueChange={(v) => set("commission_basis", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gross">Gross</SelectItem><SelectItem value="profit">Profit</SelectItem></SelectContent></Select>
              </div>
              <div><Label>Attribution (days)</Label><Input type="number" value={form.attribution_window_days} onChange={(e) => set("attribution_window_days", e.target.value)} /></div>
            </div>
            <div><Label>Contract Notes</Label><Textarea value={form.contract_notes} onChange={(e) => set("contract_notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.business_name} className="bg-brand hover:bg-brand-dark">{saving ? "Creating…" : "Create Partner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}