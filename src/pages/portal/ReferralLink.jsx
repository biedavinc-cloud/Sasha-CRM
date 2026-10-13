import { referralLinkOf } from "@/lib/format";
import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Copy, Check, Link as LinkIcon, Share2 } from "lucide-react";
import { PageHeader, Card } from "@/components/crm/ui";

export default function ReferralLink() {
  const { partner } = useOutletContext();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyCode = () => { navigator.clipboard.writeText(partner.referral_code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const copyLink = () => { navigator.clipboard.writeText(referralLinkOf(partner)); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };

  return (
    <div>
      <PageHeader title="Referral Link" subtitle="Share this with your clients to earn commissions" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3"><div className="h-9 w-9 rounded-xl bg-brand-soft/40 flex items-center justify-center"><LinkIcon className="h-4 w-4 text-brand" /></div><h3 className="text-sm font-semibold">Your Referral Code</h3></div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-4 py-3 rounded-xl text-sm font-medium tracking-wide">{partner.referral_code}</code>
            <button onClick={copyCode} className="px-3 py-3 rounded-xl bg-brand text-primary-foreground hover:bg-brand-dark transition-colors">{copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3"><div className="h-9 w-9 rounded-xl bg-brand-soft/40 flex items-center justify-center"><Share2 className="h-4 w-4 text-brand" /></div><h3 className="text-sm font-semibold">Your Referral Link</h3></div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-4 py-3 rounded-xl text-xs font-medium break-all">{referralLinkOf(partner)}</code>
            <button onClick={copyLink} className="px-3 py-3 rounded-xl bg-brand text-primary-foreground hover:bg-brand-dark transition-colors shrink-0">{copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-3">How it works</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">1</span><span>Share your unique referral link with your clients.</span></li>
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">2</span><span>When they book and complete a treatment at Sasha, the referral is attributed to you automatically.</span></li>
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">3</span><span>After Sasha validates the referral, your commission is calculated and added to your balance.</span></li>
          <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">4</span><span>Sasha processes your payout and it appears in your payout history.</span></li>
        </ol>
      </Card>
    </div>
  );
}