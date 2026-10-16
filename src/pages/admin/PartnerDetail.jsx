import React, { useState } from "react";
import { notifyError } from "@/lib/notify";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Save, Copy, Check, Wallet, TrendingUp } from "lucide-react";
import { api } from "@/api/client";
import { useRecord, useCollection, useAggregate } from "@/hooks/crm";
import { PageHeader, StatusBadge, Card, Spinner, Th, Td, StatCard } from "@/components/crm/ui";
import { formatAED, formatDate, PARTNER_STATUSES, PARTNER_TYPES, REFERRAL_STATUSES, COMMISSION_STATUSES, PAYOUT_STATUSES, referralLinkOf } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

export default function PartnerDetail() {
  const { id } = useParams();
  const { record: partner, loading, setRecord } = useRecord("Partner", id);
  const { items: services } = useCollection("Service", { active: true }, { limit: 100 });
  const { items: referrals, reload: reloadRef } = useCollection("Referral", { partner_id: id }, { sort: "-created_date", limit: 50 });
  const { items: commissions } = useCollection("Commission", { partner_id: id }, { sort: "-created_date", limit: 50 });
  const { items: payouts } = useCollection("Payout", { partner_id: id }, { sort: "-created_date", limit: 50 });
  const balRows = useAggregate("Commission", { query: { partner_id: id }, groupBy: "status", sum: "commission_amount" });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading) return <Spinner />;
  if (!partner) return <div className="py-10 text-center text-muted-foreground">Partner not found. <Link to="/admin/partners" className="text-brand hover:underline">Back to partners</Link></div>;

  const bal = (st) => balRows.find((r) => r.status === st)?.sum_commission_amount || 0;
  const totalEarned = bal("paid") + bal("payable");
  const payable = bal("payable");
  const pending = bal("pending") + bal("approved");
  const paid = bal("paid");

  const startEdit = () => { setForm({ commission_percentage: partner.commission_percentage, commission_basis: partner.commission_basis, min_transaction_amount: partner.min_transaction_amount, max_commission: partner.max_commission, attribution_window_days: partner.attribution_window_days, effective_date: partner.effective_date, expiry_date: partner.expiry_date, contract_notes: partner.contract_notes, eligible_service_ids: partner.eligible_service_ids || [], excluded_service_ids: partner.excluded_service_ids || [] }); setEditing(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleService = (list, sid) => setForm((f) => ({ ...f, [list]: f[list].includes(sid) ? f[list].filter((x) => x !== sid) : [...f[list], sid] }));

  const saveConfig = async () => {
    setSaving(true);
    try {
      const updated = await api.entities.Partner.update(id, { ...form, commission_percentage: Number(form.commission_percentage), min_transaction_amount: form.min_transaction_amount ? Number(form.min_transaction_amount) : null, max_commission: form.max_commission ? Number(form.max_commission) : null, attribution_window_days: Number(form.attribution_window_days) || 30 });
      setRecord(updated);
      setEditing(false);
    } catch (e) { notifyError(e.message); } finally { setSaving(false); }
  };

  const copyLink = () => { navigator.clipboard.writeText(referralLinkOf(partner)); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div>
      <Link to="/admin/partners" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Partners</Link>
      <PageHeader title={partner.business_name} subtitle={`${PARTNER_TYPES[partner.partner_type] || partner.partner_type} · ${partner.referral_code}`} actions={<StatusBadge status={partner.status} map={PARTNER_STATUSES} />} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Earned" value={formatAED(totalEarned)} icon={TrendingUp} />
        <StatCard label="Payable" value={formatAED(payable)} icon={Wallet} tone="brand" />
        <StatCard label="Pending" value={formatAED(pending)} icon={Wallet} tone="neutral" />
        <StatCard label="Paid" value={formatAED(paid)} icon={Wallet} tone="soft" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold mb-3">Profile</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Partner ID" value={partner.partner_id} />
            <Row label="Contact" value={partner.contact_person} />
            <Row label="Email" value={partner.email} />
            <Row label="Phone" value={partner.phone} />
            <Row label="Address" value={partner.address} />
            <Row label="Created" value={formatDate(partner.created_date)} />
          </dl>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Referral Link</h3>
            <Button variant="outline" size="sm" onClick={copyLink}>{copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}{copied ? "Copied" : "Copy"}</Button>
          </div>
          <div className="space-y-2">
            <div><p className="text-xs text-muted-foreground mb-1">Referral Code</p><code className="text-sm bg-muted px-3 py-2 rounded-lg block">{partner.referral_code}</code></div>
            <div><p className="text-xs text-muted-foreground mb-1">Referral Link</p><code className="text-xs bg-muted px-3 py-2 rounded-lg block break-all">{referralLinkOf(partner)}</code></div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="config">
        <TabsList className="mb-4">
          <TabsTrigger value="config">Commission Config</TabsTrigger>
          <TabsTrigger value="referrals">Referrals ({referrals.length})</TabsTrigger>
          <TabsTrigger value="commissions">Commissions ({commissions.length})</TabsTrigger>
          <TabsTrigger value="payouts">Payouts ({payouts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <Card className="p-5">
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label htmlFor="f-commission-1">Commission %</Label><Input id="f-commission-1" type="number" value={form.commission_percentage} onChange={(e) => set("commission_percentage", e.target.value)} /></div>
                  <div><Label htmlFor="f-basis-2">Basis</Label><Select value={form.commission_basis} onValueChange={(v) => set("commission_basis", v)}><SelectTrigger id="f-basis-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gross">Gross Amount</SelectItem><SelectItem value="profit">Profit</SelectItem></SelectContent></Select></div>
                  <div><Label htmlFor="f-min-transaction-3">Min Transaction</Label><Input id="f-min-transaction-3" type="number" value={form.min_transaction_amount || ""} onChange={(e) => set("min_transaction_amount", e.target.value)} placeholder="0" /></div>
                  <div><Label htmlFor="f-max-commission-4">Max Commission</Label><Input id="f-max-commission-4" type="number" value={form.max_commission || ""} onChange={(e) => set("max_commission", e.target.value)} placeholder="None" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="f-effective-date-5">Effective Date</Label><Input id="f-effective-date-5" type="date" value={form.effective_date || ""} onChange={(e) => set("effective_date", e.target.value)} /></div>
                  <div><Label htmlFor="f-expiry-date-6">Expiry Date</Label><Input id="f-expiry-date-6" type="date" value={form.expiry_date || ""} onChange={(e) => set("expiry_date", e.target.value)} /></div>
                </div>
                <div><Label htmlFor="f-attribution-window-days-7">Attribution Window (days)</Label><Input id="f-attribution-window-days-7" type="number" value={form.attribution_window_days} onChange={(e) => set("attribution_window_days", e.target.value)} /></div>
                <div>
                  <Label>Eligible Services (empty = all eligible)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {services.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Switch checked={form.eligible_service_ids.includes(s.id)} onCheckedChange={() => toggleService("eligible_service_ids", s.id)} />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div><Label htmlFor="f-contract-notes-9">Contract Notes</Label><Textarea id="f-contract-notes-9" value={form.contract_notes || ""} onChange={(e) => set("contract_notes", e.target.value)} rows={2} /></div>
                <div className="flex gap-2"><Button onClick={saveConfig} disabled={saving} className="bg-brand hover:bg-brand-dark"><Save className="h-4 w-4 mr-1.5" />{saving ? "Saving…" : "Save Config"}</Button><Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <Row label="Commission Rate" value={`${partner.commission_percentage}%`} />
                  <Row label="Basis" value={partner.commission_basis === "profit" ? "Profit" : "Gross Amount"} />
                  <Row label="Min Transaction" value={partner.min_transaction_amount ? formatAED(partner.min_transaction_amount) : "None"} />
                  <Row label="Max Commission" value={partner.max_commission ? formatAED(partner.max_commission) : "None"} />
                  <Row label="Attribution Window" value={`${partner.attribution_window_days || 30} days`} />
                  <Row label="Effective" value={formatDate(partner.effective_date)} />
                  <Row label="Expiry" value={formatDate(partner.expiry_date)} />
                </div>
                {partner.contract_notes && <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{partner.contract_notes}</div>}
                <Button variant="outline" onClick={startEdit}>Edit Commission Config</Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="referrals">
          <Card className="overflow-hidden">
            <ReferralTable referrals={referrals} />
          </Card>
        </TabsContent>
        <TabsContent value="commissions">
          <Card className="overflow-hidden">
            <CommissionTable commissions={commissions} />
          </Card>
        </TabsContent>
        <TabsContent value="payouts">
          <Card className="overflow-hidden">
            <PayoutTable payouts={payouts} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="font-medium text-right truncate">{value || "—"}</dd>
    </div>
  );
}

function ReferralTable({ referrals }) {
  if (!referrals.length) return <p className="text-sm text-muted-foreground py-10 text-center">No referrals yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50"><tr><Th>Client</Th><Th>Service</Th><Th>Status</Th><Th className="text-right">Gross</Th><Th>Date</Th></tr></thead>
        <tbody className="divide-y divide-border">
          {referrals.map((r) => (
            <tr key={r.id} className="hover:bg-muted/30">
              <Td className="font-medium">{r.client_name}</Td><Td>{r.service_name || r.service_category || "—"}</Td>
              <Td><StatusBadge status={r.status} map={REFERRAL_STATUSES} /></Td>
              <Td className="text-right">{r.gross_amount ? formatAED(r.gross_amount) : "—"}</Td>
              <Td className="text-muted-foreground">{formatDate(r.created_date)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommissionTable({ commissions }) {
  if (!commissions.length) return <p className="text-sm text-muted-foreground py-10 text-center">No commissions yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50"><tr><Th>Referral</Th><Th>Basis</Th><Th className="text-right">Eligible</Th><Th className="text-right">Rate</Th><Th className="text-right">Amount</Th><Th>Status</Th></tr></thead>
        <tbody className="divide-y divide-border">
          {commissions.map((c) => (
            <tr key={c.id} className="hover:bg-muted/30">
              <Td className="font-medium">{c.client_name || c.service_name || "—"}</Td><Td className="capitalize">{c.basis}</Td>
              <Td className="text-right">{formatAED(c.eligible_amount)}</Td><Td className="text-right">{c.commission_rate}%</Td>
              <Td className="text-right font-medium">{formatAED(c.commission_amount)}</Td>
              <Td><StatusBadge status={c.status} map={COMMISSION_STATUSES} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayoutTable({ payouts }) {
  if (!payouts.length) return <p className="text-sm text-muted-foreground py-10 text-center">No payouts yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-muted/50"><tr><Th>Payout ID</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Reference</Th><Th>Date</Th></tr></thead>
        <tbody className="divide-y divide-border">
          {payouts.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30">
              <Td className="font-medium">{p.payout_id}</Td><Td className="text-right font-medium">{formatAED(p.amount)}</Td>
              <Td><StatusBadge status={p.status} map={PAYOUT_STATUSES} /></Td>
              <Td className="text-muted-foreground">{p.payment_reference || "—"}</Td>
              <Td className="text-muted-foreground">{formatDate(p.payment_date || p.created_date)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}