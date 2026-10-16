import React, { useState } from "react";
import { notifyError } from "@/lib/notify";
import { Plus, Calendar as CalIcon } from "lucide-react";
import { api } from "@/api/client";
import { useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { APPOINTMENT_STATUSES, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const empty = { client_name: "", service_id: "", date: "", time: "", staff_name: "", partner_id: "", status: "booked", notes: "" };

export default function Appointments() {
  const { items: appts, loading, reload } = useCollection("Appointment", {}, { sort: "-date", limit: 2000 });
  const { items: services } = useCollection("Service", { active: true }, { limit: 100 });
  const { items: partners } = useCollection("Partner", { status: "active" }, { limit: 100, fields: ["business_name"] });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.client_name || !form.date) return;
    setSaving(true);
    try {
      const svc = services.find((s) => s.id === form.service_id);
      const partner = partners.find((p) => p.id === form.partner_id);
      await api.entities.Appointment.create({ ...form, appointment_id: "A-" + Date.now().toString().slice(-6), service_name: svc?.name || "", partner_name: partner?.business_name || "" });
      setOpen(false); setForm(empty); reload();
    } catch (e) { notifyError(e.message); } finally { setSaving(false); }
  };

  const updateStatus = async (a, status) => { await api.entities.Appointment.update(a.id, { status }); reload(); };

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Clinic appointment schedule" actions={<Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark"><Plus className="h-4 w-4 mr-1.5" /> New Appointment</Button>} />
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : appts.length === 0 ? (
          <EmptyState icon={CalIcon} title="No appointments yet" description="Book appointments for your clients." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Client</Th><Th>Service</Th><Th>Date</Th><Th>Time</Th><Th>Staff</Th><Th>Partner</Th><Th>Status</Th><Th></Th></tr></thead>
              <tbody className="divide-y divide-border">
                {appts.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{a.client_name}</Td>
                    <Td>{a.service_name}</Td>
                    <Td>{formatDate(a.date)}</Td>
                    <Td className="text-muted-foreground">{a.time || "—"}</Td>
                    <Td className="text-muted-foreground">{a.staff_name || "—"}</Td>
                    <Td>{a.partner_name || "—"}</Td>
                    <Td><StatusBadge status={a.status} map={APPOINTMENT_STATUSES} /></Td>
                    <Td>
                      <Select value={a.status} onValueChange={(v) => updateStatus(a, v)}>
                        <SelectTrigger aria-label="Appointment status" className="h-8 w-28 text-xs border-0 bg-muted"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(APPOINTMENT_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
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
          <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="f-client-name-1">Client Name *</Label><Input id="f-client-name-1" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="f-service-2">Service</Label><Select value={form.service_id} onValueChange={(v) => set("service_id", v)}><SelectTrigger id="f-service-2"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="f-staff-3">Staff</Label><Input id="f-staff-3" value={form.staff_name} onChange={(e) => set("staff_name", e.target.value)} placeholder="Dr. / Specialist" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="f-date-4">Date *</Label><Input id="f-date-4" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div>
              <div><Label htmlFor="f-time-5">Time</Label><Input id="f-time-5" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></div>
            </div>
            <div><Label htmlFor="f-referral-partner-6">Referral Partner</Label><Select value={form.partner_id} onValueChange={(v) => set("partner_id", v)}><SelectTrigger id="f-referral-partner-6"><SelectValue placeholder="None" /></SelectTrigger><SelectContent><SelectItem value={null}>None</SelectItem>{partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="f-notes-7">Notes</Label><Textarea id="f-notes-7" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={handleCreate} disabled={saving || !form.client_name || !form.date} className="bg-brand hover:bg-brand-dark">{saving ? "Saving…" : "Book"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}