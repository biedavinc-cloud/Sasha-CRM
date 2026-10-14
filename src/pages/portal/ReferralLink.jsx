import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import QRCode from "qrcode";
import { Copy, Check, Link as LinkIcon, Share2, MessageCircle, Mail, Download, QrCode } from "lucide-react";
import { PageHeader, Card } from "@/components/crm/ui";
import { referralLinkOf } from "@/lib/format";

// One tracked link per channel, so partners (and the clinic) can see which channel brings clients.
const CHANNELS = [
  { key: "instagram", label: "Instagram bio / story", medium: "social" },
  { key: "whatsapp", label: "WhatsApp", medium: "messaging" },
  { key: "facebook", label: "Facebook", medium: "social" },
  { key: "email", label: "Email", medium: "email" },
  { key: "qr", label: "QR code / printed material", medium: "offline" },
];
const tracked = (link, c) => `${link}?utm_source=${c.key}&utm_medium=${c.medium}`;

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (key, text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable: nothing to do */ }
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? "" : k)), 2000);
  };
  return [copied, copy];
}

export default function ReferralLink() {
  const { partner } = useOutletContext();
  const link = referralLinkOf(partner);
  const [copied, copy] = useCopy();
  const [svg, setSvg] = useState("");
  const qrTarget = tracked(link, CHANNELS[4]);

  useEffect(() => {
    let alive = true;
    QRCode.toString(qrTarget, { type: "svg", margin: 1, width: 240, color: { dark: "#111111", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => {});
    return () => { alive = false; };
  }, [qrTarget]);

  const message = `Hi! I recommend Sasha Aesthetics. Book your consultation here: ${tracked(link, CHANNELS[1])}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const mailto = `mailto:?subject=${encodeURIComponent("Book your consultation at Sasha Aesthetics")}&body=${encodeURIComponent(`Hello,\n\nI recommend Sasha Aesthetics. You can book your consultation here:\n${tracked(link, CHANNELS[3])}\n`)}`;

  const download = (href, name) => { const a = document.createElement("a"); a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  const downloadSvg = () => { const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })); download(url, `${partner.referral_code}-qr.svg`); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const downloadPng = () => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = c.height = 1024;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 1024, 1024); ctx.drawImage(img, 0, 0, 1024, 1024);
      c.toBlob((b) => { if (b) { const u = URL.createObjectURL(b); download(u, `${partner.referral_code}-qr.png`); setTimeout(() => URL.revokeObjectURL(u), 1000); } });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const Btn = ({ onClick, href, children, label }) => {
    const cls = "inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand text-primary-foreground text-sm font-medium hover:bg-brand-dark transition-colors";
    return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={label}>{children}</a> : <button type="button" onClick={onClick} className={cls} aria-label={label}>{children}</button>;
  };

  return (
    <div>
      <PageHeader title="Referral Link" subtitle="Share this with your clients to earn commissions" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><div className="h-9 w-9 rounded-xl bg-brand-soft/40 flex items-center justify-center"><LinkIcon className="h-4 w-4 text-brand" /></div><h3 className="text-sm font-semibold">Your personal link</h3></div>
          <code data-testid="referral-link" className="block bg-muted px-4 py-3 rounded-xl text-sm font-medium break-all mb-3">{link}</code>
          <p className="text-xs text-muted-foreground mb-4">Your code: <span className="font-semibold text-foreground">{partner.referral_code}</span></p>
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => copy("link", link)} label="Copy link">{copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied === "link" ? "Copied!" : "Copy link"}</Btn>
            <Btn href={whatsapp} label="Share on WhatsApp"><MessageCircle className="h-4 w-4" />WhatsApp</Btn>
            <Btn href={mailto} label="Share by email"><Mail className="h-4 w-4" />Email</Btn>
          </div>
        </Card>

        <Card className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3"><QrCode className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">QR code</h3></div>
          <div data-testid="qr" className="mx-auto w-[200px] h-[200px] [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="text-xs text-muted-foreground mt-2 mb-3">For flyers, your counter or business cards. Scans are tracked as “QR code”.</p>
          <div className="flex justify-center gap-2">
            <Btn onClick={downloadPng} label="Download QR as PNG"><Download className="h-4 w-4" />PNG</Btn>
            <Btn onClick={downloadSvg} label="Download QR as SVG"><Download className="h-4 w-4" />SVG</Btn>
          </div>
        </Card>
      </div>

      <Card className="p-6 mb-4">
        <div className="flex items-center gap-2 mb-1"><Share2 className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Tracked links by channel</h3></div>
        <p className="text-xs text-muted-foreground mb-4">Use a different link per channel to see where your clients come from. All of them credit you.</p>
        <ul className="divide-y divide-border">
          {CHANNELS.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="text-sm font-medium">{c.label}</p><p className="text-xs text-muted-foreground truncate">{tracked(link, c)}</p></div>
              <button type="button" onClick={() => copy(c.key, tracked(link, c))} aria-label={`Copy ${c.label} link`} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">{copied === c.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === c.key ? "Copied" : "Copy"}</button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h3 className="text-sm font-semibold mb-3">How it works</h3>
        <ol className="space-y-3 text-sm text-muted-foreground">
          {["Share your link (or QR code) with your clients.", "When they book and leave their details, the referral is credited to you.", "After Sasha Aesthetics completes their treatment, your commission is calculated.", "Approved commissions are paid out to you. Follow everything in your dashboard."].map((t, i) => (
            <li key={i} className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">{i + 1}</span><span>{t}</span></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
