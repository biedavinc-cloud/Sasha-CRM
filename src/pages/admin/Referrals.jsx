import React, { useState } from "react";
import { notifyError } from "@/lib/notify";
import { Link } from "react-router-dom";
import { Plus, Share2, Search, Flag } from "lucide-react";
import { api } from "@/api/client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { REFERRAL_STATUSES, formatDate, formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const empty = { partner_id: "", client_name: "", client_phone: "", client_email: "", service_id: "", service_category: "", status: "lead_created", gross_amount: "" };

export default function Referrals() {
  const { items: referrals, loading, reload } = useCollection("Referral", {}, { sort: "-created_date", limit: 2000 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 100, fields: ["business_name", "user_id"] });
  const { items: services } = useCollection("Service", { active: true }, { limit: 100 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const filtered = referrals.filter((r) =>
    (statusFilter === "all" || r.status === statusFilter) &&
    ((r.client_name || "").toLowerCase().includes(search.toLowerCase()) || (r.partner_name || "").toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async () => {
    if (!form.partner_id || !form.client_name) return;
    setSaving(true);
    try {
      const partner = partners.find((p) => p.id === form.partner_id);
      const svc = services.find((s) => s.id === form.service_id);
      await api.entities.Referral.create({
        ...form,
        referral_id: "R-" + Date.now().toString().slice(-6),
        partner_name: partner?.business_name || "",
        partner_user_id: partner?.user_id || "",
        service_name: svc?.name || "",
        service_category: svc?.category || form.service_category,
        gross_amount: Number(form.gross_amount) || 0,
      });
      setOpen(false); setForm(empty); reload();
    } catch (e) { notifyError(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Referrals" subtitle="Partner referral lifecycle & attribution" actions={<Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Referral</Button>} />
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search client or partner…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by status" className="w-full sm:w-48"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.entries(REFERRAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={Share2} title="No referrals yet" description="Referrals are created when clients enter through partner links, or manually here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Client</Th><Th>Partner</Th><Th>Service</Th><Th>Status</Th><Th className="text-right">Gross</Th><Th>Date</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <Td className="font-medium">
                      <Link to={`/admin/referrals/${r.id}`} className="hover:text-brand flex items-center gap-1.5">
                        {r.fraud_flag && <Flag className="h-3.5 w-3.5 text-amber-500" />}
                        {r.client_name}
                      </Link>
                    </Td>
                    <Td>{r.partner_name}</Td>
                    <Td className="text-muted-foreground">{r.service_name || r.service_category || "—"}</Td>
                    <Td><StatusBadge status={r.status} map={REFERRAL_STATUSES} /></Td>
                    <Td className="text-right">{r.gross_amount ? formatAED(r.gross_amount) : "—"}</Td>
                    <Td className="text-muted-foreground">{formatDate(r.created_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Referral</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="f-partner-1">Partner *</Label><Select value={form.partner_id} onValueChange={(v) => set("partner_id", v)}><SelectTrigger id="f-partner-1"><SelectValue placeholder="Select partner" /></SelectTrigger><SelectContent>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="f-client-name-2">Client Name *</Label><Input id="f-client-name-2" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="f-phone-3">Phone</Label><Input id="f-phone-3" value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} /></div>
              <div><Label htmlFor="f-email-4">Email</Label><Input id="f-email-4" type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} /></div>
            </div>
            <div><Label htmlFor="f-service-5">Service</Label><Select value={form.service_id} onValueChange={(v) => set("service_id", v)}><SelectTrigger id="f-service-5"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="f-status-6">Status</Label><Select value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger id="f-status-6"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(REFERRAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="f-gross-amount-7">Gross Amount</Label><Input id="f-gross-amount-7" type="number" value={form.gross_amount} onChange={(e) => set("gross_amount", e.target.value)} placeholder="AED" /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !form.partner_id || !form.client_name} className="bg-brand hover:bg-brand-dark">{saving ? "Saving…" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}