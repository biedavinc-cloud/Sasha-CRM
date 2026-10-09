import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Save, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card } from "@/components/crm/ui";
import { PARTNER_TYPES } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Profile() {
  const { partner } = useOutletContext();
  const [form, setForm] = useState({ contact_person: partner.contact_person || "", phone: partner.phone || "", address: partner.address || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke('updatePartnerProfile', form);
      if (res.data?.error) throw new Error(res.data.error);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Profile" subtitle="Your business information on file" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Business Details</h3>
          <dl className="space-y-2.5 text-sm">
            <Row label="Business Name" value={partner.business_name} />
            <Row label="Partner Type" value={PARTNER_TYPES[partner.partner_type] || partner.partner_type} />
            <Row label="Partner ID" value={partner.partner_id} />
            <Row label="Email" value={partner.email} />
            <Row label="Status" value={partner.status} />
            <Row label="Member Since" value={new Date(partner.created_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} />
          </dl>
          <p className="text-xs text-muted-foreground mt-4">Business name, type and email are managed by Sasha Aesthetic Clinic. Contact us to update them.</p>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold mb-4">Editable Information</h3>
          <div className="space-y-3">
            <div><Label>Contact Person</Label><Input value={form.contact_person} onChange={(e) => set("contact_person", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-dark">{saved ? <Check className="h-4 w-4 mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}{saving ? "Saving…" : saved ? "Saved" : "Save Changes"}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"><dt className="text-muted-foreground shrink-0">{label}</dt><dd className="font-medium text-right truncate">{value || "—"}</dd></div>;
}