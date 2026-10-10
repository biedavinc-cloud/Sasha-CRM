import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Flag, Calculator, Check } from "lucide-react";
import { api } from "@/api/client";
import { useRecord, useCollection } from "@/hooks/crm";
import { PageHeader, StatusBadge, Card, Spinner } from "@/components/crm/ui";
import { REFERRAL_STATUSES, formatAED, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FLOW = ["clicked", "lead_created", "contacted", "appointment_booked", "appointment_completed", "treatment_completed", "satisfaction_confirmed", "commission_pending", "commission_payable", "paid"];

export default function ReferralDetail() {
  const { id } = useParams();
  const { record: referral, loading, setRecord } = useRecord("Referral", id);
  const { items: commissions } = useCollection("Commission", { referral_id: id }, { limit: 10 });
  const [processing, setProcessing] = useState(false);
  const [gross, setGross] = useState("");
  const [eligible, setEligible] = useState("");
  const [done, setDone] = useState(false);

  if (loading) return <Spinner />;
  if (!referral) return <div className="py-10 text-center text-muted-foreground">Referral not found. <Link to="/admin/referrals" className="text-brand hover:underline">Back</Link></div>;

  const currentStep = FLOW.indexOf(referral.status);
  const canProcess = ["treatment_completed", "satisfaction_confirmed"].includes(referral.status) || (referral.status === "commission_pending" && !referral.commission_id);

  const processCommission = async () => {
    setProcessing(true);
    try {
      const res = await api.functions.invoke("processCommission", { referralId: id, grossAmount: Number(gross) || undefined, eligibleAmount: Number(eligible) || undefined });
      setRecord({ ...referral, status: "commission_pending", gross_amount: res.data?.commission?.gross_amount ?? referral.gross_amount, commission_id: res.data?.commission?.id });
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) { alert(e.response?.data?.error || e.message); } finally { setProcessing(false); }
  };

  const advanceStatus = async (status) => { const updated = await api.entities.Referral.update(id, { status }); setRecord(updated); };

  return (
    <div>
      <Link to="/admin/referrals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Referrals</Link>
      <PageHeader title={referral.client_name} subtitle={`${referral.partner_name} · ${referral.referral_id}`} actions={<StatusBadge status={referral.status} map={REFERRAL_STATUSES} />} />

      {referral.fraud_flag && (
        <div className="mb-4 flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl p-3 text-sm">
          <Flag className="h-4 w-4" /> <span className="font-medium">Flagged for review:</span> {referral.fraud_reason}
        </div>
      )}

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold mb-4">Referral Lifecycle</h3>
        <div className="flex flex-wrap gap-2">
          {FLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${i <= currentStep ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i <= currentStep && <Check className="h-3 w-3" />}
                {REFERRAL_STATUSES[step].label}
              </div>
              {i < FLOW.length - 1 && <div className={`h-px w-4 ${i < currentStep ? "bg-brand" : "bg-border"}`} />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Client Details</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={referral.client_name} />
            <Row label="Phone" value={referral.client_phone} />
            <Row label="Email" value={referral.client_email} />
            <Row label="Service" value={referral.service_name || referral.service_category} />
            <Row label="Appointment" value={referral.appointment_date ? formatDate(referral.appointment_date) : "—"} />
            <Row label="Created" value={formatDate(referral.created_date)} />
          </dl>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3">Financials & Commission</h3>
          <dl className="space-y-2 text-sm mb-4">
            <Row label="Gross Amount" value={referral.gross_amount ? formatAED(referral.gross_amount) : "—"} />
            <Row label="Eligible Amount" value={referral.eligible_amount ? formatAED(referral.eligible_amount) : "—"} />
            <Row label="Commission" value={commissions[0] ? formatAED(commissions[0].commission_amount) : "—"} />
          </dl>
          {canProcess ? (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Enter the treatment amount to calculate commission based on the partner's contract.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gross (AED)</Label><Input type="number" value={gross} onChange={(e) => setGross(e.target.value)} placeholder={referral.gross_amount || "1000"} /></div>
                <div><Label>Eligible / Profit</Label><Input type="number" value={eligible} onChange={(e) => setEligible(e.target.value)} placeholder="For profit basis" /></div>
              </div>
              <Button onClick={processCommission} disabled={processing} className="bg-brand hover:bg-brand-dark w-full"><Calculator className="h-4 w-4 mr-1.5" />{processing ? "Processing…" : done ? "Commission Created" : "Process Commission"}</Button>
            </div>
          ) : referral.commission_id ? (
            <div className="border-t border-border pt-3 text-sm text-muted-foreground">Commission already generated. <Link to="/admin/commissions" className="text-brand hover:underline">View in Commissions</Link></div>
          ) : (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-2">Advance the referral status once the client journey progresses:</p>
              <Select value={referral.status} onValueChange={advanceStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(REFERRAL_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0"><dt className="text-muted-foreground shrink-0">{label}</dt><dd className="font-medium text-right truncate">{value || "—"}</dd></div>;
}