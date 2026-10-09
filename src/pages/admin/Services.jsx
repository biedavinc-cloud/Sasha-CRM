import React, { useState } from "react";
import { Plus, Sparkles, Pencil } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const CATS = ["PRP Hair", "PRF Face", "HydraFacial", "Laser Hair Removal", "Other"];
const empty = { name: "", category: "PRP Hair", price: "", description: "", active: true, commission_eligible: true };

export default function Services() {
  const { items: services, loading, reload } = useCollection("Service", {}, { sort: "category", limit: 200 });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => { setEditId(s.id); setForm({ name: s.name, category: s.category, price: s.price || "", description: s.description || "", active: s.active !== false, commission_eligible: s.commission_eligible !== false }); setOpen(true); };

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const payload = { ...form, price: Number(form.price) || 0 };
      if (editId) await base44.entities.Service.update(editId, payload);
      else await base44.entities.Service.create(payload);
      setOpen(false); reload();
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Services" subtitle="Clinic services & commission eligibility" actions={<Button onClick={openCreate} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Service</Button>} />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : services.length === 0 ? (
          <EmptyState icon={Sparkles} title="No services yet" description="Add your clinic services. Only commission-eligible services generate partner commissions." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Service</Th><Th>Category</Th><Th className="text-right">Price</Th><Th>Commission Eligible</Th><Th>Active</Th><Th></Th></tr></thead>
              <tbody className="divide-y divide-border">
                {services.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{s.name}<p className="text-xs text-muted-foreground">{s.description}</p></Td>
                    <Td className="text-muted-foreground">{s.category}</Td>
                    <Td className="text-right">{formatAED(s.price)}</Td>
                    <Td>{s.commission_eligible ? <span className="text-emerald-600 text-xs font-medium">Yes</span> : <span className="text-muted-foreground text-xs">No</span>}</Td>
                    <Td>{s.active ? <span className="text-emerald-600 text-xs font-medium">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</Td>
                    <Td><Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit Service" : "New Service"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><Label>Category</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Price (AED)</Label><Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} /></div>
            <div className="flex items-center justify-between"><Label>Commission Eligible</Label><Switch checked={form.commission_eligible} onCheckedChange={(v) => set("commission_eligible", v)} /></div>
            <div className="flex items-center justify-between"><Label>Active</Label><Switch checked={form.active} onCheckedChange={(v) => set("active", v)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleSave} disabled={saving || !form.name} className="bg-brand hover:bg-brand-dark">{saving ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}