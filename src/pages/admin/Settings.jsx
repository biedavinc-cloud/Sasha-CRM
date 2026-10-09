import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Building2, Share2, Bell, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, Spinner } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULTS = {
  setting_key: "default",
  clinic_name: "Sasha Aesthetic Clinic",
  clinic_phone: "",
  clinic_email: "",
  clinic_address: "",
  referral_base_url: "https://sasha.ae/r/",
  default_attribution_window_days: 30,
  default_commission_percentage: 10,
  default_commission_basis: "gross",
  notify_email_on_commission_approval: true,
  notify_email_on_payout: true,
  notify_whatsapp_on_payout: false,
  whatsapp_template: "",
};

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.ClinicSetting.filter({ setting_key: "default" }, { limit: 1 });
      const items = page.items || [];
      if (items.length > 0) {
        setSettings(items[0]);
        setRecordId(items[0].id);
      } else {
        const created = await base44.entities.ClinicSetting.create(DEFAULTS);
        setSettings(created);
        setRecordId(created.id);
      }
    } catch (e) {
      setSettings({ ...DEFAULTS });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const update = (field, value) => setSettings((s) => ({ ...s, [field]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.ClinicSetting.update(recordId, settings);
      setSettings(updated);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) return <div className="flex justify-center py-20"><Spinner /></div>;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Clinic profile, referral defaults & notifications" actions={
        <Button onClick={save} disabled={saving} className="bg-brand hover:bg-brand-dark"><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save Changes"}</Button>
      } />

      <div className="space-y-6 max-w-3xl">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Building2 className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Clinic Profile</h3></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label>Clinic Name</Label><Input value={settings.clinic_name || ""} onChange={(e) => update("clinic_name", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={settings.clinic_phone || ""} onChange={(e) => update("clinic_phone", e.target.value)} placeholder="+971 4 123 4567" /></div>
            <div><Label>Email</Label><Input type="email" value={settings.clinic_email || ""} onChange={(e) => update("clinic_email", e.target.value)} placeholder="info@sasha.ae" /></div>
            <div className="sm:col-span-2"><Label>Address</Label><Textarea value={settings.clinic_address || ""} onChange={(e) => update("clinic_address", e.target.value)} rows={2} placeholder="JVC, Dubai, UAE" /></div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Share2 className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Referral Defaults</h3></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label>Referral Link Base URL</Label><Input value={settings.referral_base_url || ""} onChange={(e) => update("referral_base_url", e.target.value)} placeholder="https://sasha.ae/r/" /><p className="text-xs text-muted-foreground mt-1">Partner referral links are built as {settings.referral_base_url || "…"}[referral_code]</p></div>
            <div><Label>Default Attribution Window (days)</Label><Input type="number" value={settings.default_attribution_window_days} onChange={(e) => update("default_attribution_window_days", Number(e.target.value))} /></div>
            <div><Label>Default Commission (%)</Label><Input type="number" step="0.1" value={settings.default_commission_percentage} onChange={(e) => update("default_commission_percentage", Number(e.target.value))} /></div>
            <div><Label>Default Commission Basis</Label>
              <Select value={settings.default_commission_basis} onValueChange={(v) => update("default_commission_basis", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="gross">Gross (full invoice)</SelectItem>
                <SelectItem value="profit">Profit (after costs)</SelectItem>
              </SelectContent></Select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Bell className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Notifications</h3></div>
          <div className="space-y-4">
            <ToggleRow label="Email partners on commission approval" checked={!!settings.notify_email_on_commission_approval} onChange={(v) => update("notify_email_on_commission_approval", v)} />
            <ToggleRow label="Email partners on payout" checked={!!settings.notify_email_on_payout} onChange={(v) => update("notify_email_on_payout", v)} />
            <ToggleRow label="WhatsApp partners on payout" checked={!!settings.notify_whatsapp_on_payout} onChange={(v) => update("notify_whatsapp_on_payout", v)} />
            <div><Label>WhatsApp Message Template</Label><Textarea value={settings.whatsapp_template || ""} onChange={(e) => update("whatsapp_template", e.target.value)} rows={3} placeholder="Hi {partner}, a payout of AED {amount} has been sent. Reference: {reference}" /><p className="text-xs text-muted-foreground mt-1">Variables: {`{partner}, {amount}, {reference}, {date}`}</p></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}