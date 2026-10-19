import ChangePassword from "@/components/crm/ChangePassword";
import { notifyError } from "@/lib/notify";
import React, { useState, useEffect } from "react";
import { Building2, Share2, Bell, Save } from "lucide-react";
import { api } from "@/api/client";
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
  referral_base_url: "",
  default_attribution_window_days: 30,
  default_commission_percentage: 10,
  default_commission_basis: "gross",
  notify_email_on_commission_approval: true,
  notify_email_on_payout: true,
  notify_whatsapp_on_payout: false,
  whatsapp_template: "",
};

// An early default pointed links at a made-up domain; it must never be shown or kept as if it were a real choice.
const PLACEHOLDER_DOMAIN = /^https?:\/\/(www\.)?sasha\.ae(\/r)?\/?$/i;
const cleanSettings = (s) => (s && PLACEHOLDER_DOMAIN.test(s.referral_base_url || "") ? { ...s, referral_base_url: "" } : s);

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordId, setRecordId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const page = await api.entities.ClinicSetting.filter({ setting_key: "default" }, { limit: 1 });
      const items = page.items || [];
      if (items.length > 0) {
        setSettings(cleanSettings(items[0]));
        setRecordId(items[0].id);
      } else {
        const created = await api.entities.ClinicSetting.create(DEFAULTS);
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
      const updated = await api.entities.ClinicSetting.update(recordId, settings);
      setSettings(cleanSettings(updated));
    } catch (e) {
      notifyError(e.message);
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
            <div className="sm:col-span-2"><Label htmlFor="f-clinic-name-1">Clinic Name</Label><Input id="f-clinic-name-1" value={settings.clinic_name || ""} onChange={(e) => update("clinic_name", e.target.value)} /></div>
            <div><Label htmlFor="f-phone-2">Phone</Label><Input id="f-phone-2" value={settings.clinic_phone || ""} onChange={(e) => update("clinic_phone", e.target.value)} placeholder="+971 4 123 4567" /></div>
            <div><Label htmlFor="f-email-3">Email</Label><Input id="f-email-3" type="email" value={settings.clinic_email || ""} onChange={(e) => update("clinic_email", e.target.value)} placeholder="info@sasha.ae" /></div>
            <div className="sm:col-span-2"><Label htmlFor="f-address-4">Address</Label><Textarea id="f-address-4" value={settings.clinic_address || ""} onChange={(e) => update("clinic_address", e.target.value)} rows={2} placeholder="JVC, Dubai, UAE" /></div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4"><Share2 className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Referral Defaults</h3></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label htmlFor="f-custom-link-domain-optio-5">Custom link domain (optional)</Label><Input id="f-custom-link-domain-optio-5" value={settings.referral_base_url || ""} onChange={(e) => update("referral_base_url", e.target.value)} placeholder="https://join.yourdomain.com" /><p className="text-xs text-muted-foreground mt-1">Leave empty to use this site's address. Only fill it after adding the domain to Cloudflare Pages (Custom domains): partner links become https://your-domain/r/CODE.</p></div>
            <div><Label htmlFor="f-default-attribution-wind-6">Default Attribution Window (days)</Label><Input id="f-default-attribution-wind-6" type="number" value={settings.default_attribution_window_days} onChange={(e) => update("default_attribution_window_days", Number(e.target.value))} /></div>
            <div><Label htmlFor="f-default-commission-7">Default Commission (%)</Label><Input id="f-default-commission-7" type="number" step="0.1" value={settings.default_commission_percentage} onChange={(e) => update("default_commission_percentage", Number(e.target.value))} /></div>
            <div><Label htmlFor="f-default-commission-basis-8">Default Commission Basis</Label>
              <Select value={settings.default_commission_basis} onValueChange={(v) => update("default_commission_basis", v)}><SelectTrigger id="f-default-commission-basis-8"><SelectValue /></SelectTrigger><SelectContent>
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
            <div><Label htmlFor="f-whatsapp-message-templat-9">WhatsApp Message Template</Label><Textarea id="f-whatsapp-message-templat-9" value={settings.whatsapp_template || ""} onChange={(e) => update("whatsapp_template", e.target.value)} rows={3} placeholder="Hi {partner}, a payout of AED {amount} has been sent. Reference: {reference}" /><p className="text-xs text-muted-foreground mt-1">Variables: {`{partner}, {amount}, {reference}, {date}`}</p></div>
          </div>
        </Card>
      </div>
      <div className="mt-4"><ChangePassword /></div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm">{label}</span>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}