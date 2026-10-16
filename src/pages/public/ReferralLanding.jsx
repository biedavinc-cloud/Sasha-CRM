import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

const LOGO_URL =
  "https://media.base44.com/images/public/6ac79288ee14219d24c0ade5/ed87ef57a_SashaAestheticsLogo-4.png";
const BG_IMAGE =
  "https://images.unsplash.com/photo-1631730486572-226e5cabe731?w=1200&q=80";

const SERVICE_CATEGORIES = [
  "Hair Transplant & Restoration",
  "IV Therapy",
  "Facials & Skin Care",
  "Slimming & Body Sculpting",
  "Dental & Cosmetics",
  "Laser Hair Removal",
  "Fillers & Dermatology",
  "Permanent Makeup",
  "Other",
];

export default function ReferralLanding() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const [stage, setStage] = useState("loading");
  const [partnerName, setPartnerName] = useState("");
  const [clickId, setClickId] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", service: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [honeypot, setHoneypot] = useState("");

  useEffect(() => { document.title = "Book your consultation | Sasha Aesthetics"; }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.functions.invoke("trackClick", {
          referralCode: code,
          utmSource: searchParams.get("utm_source"),
          utmMedium: searchParams.get("utm_medium"),
          utmCampaign: searchParams.get("utm_campaign"),
          referrerSource: document.referrer || null,
        });
        setPartnerName(res.partnerName || "Sasha Aesthetics");
        setClickId(res.clickId || null);
        setStage("form");
      } catch (e) {
        setErrorMsg(e.response?.data?.error || "Invalid referral link");
        setStage("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (honeypot) { setStage("success"); return; } // a bot filled the hidden field: pretend it worked, store nothing
    const phone = form.phone.replace(/[\s().-]/g, "");
    if (!/^\+?[0-9]{7,15}$/.test(phone)) { setFormError("Please enter a valid phone number, e.g. +971 50 123 4567."); return; }
    setStage("submitting");
    try {
      await api.functions.invoke("captureReferral", {
        referralCode: code,
        clientName: form.name.trim(),
        clientPhone: phone,
        clientEmail: form.email.trim(),
        serviceInterest: form.service,
        clickId,
        utmSource: searchParams.get("utm_source"),
        utmMedium: searchParams.get("utm_medium"),
        utmCampaign: searchParams.get("utm_campaign"),
      });
      setStage("success");
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.error || "Something went wrong. Please try again.";
      if (status === 404) { setErrorMsg(msg); setStage("error"); } // the link itself is no longer valid
      else { setFormError(msg); setStage("form"); }                // anything else: keep the form so the visitor can fix it
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Branded panel — desktop */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img src={BG_IMAGE} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-black/85" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <Image src={LOGO_URL} alt="Sasha Aesthetics" className="w-12 h-12 rounded-full" fittingType="fill" />
            <span className="font-heading text-lg font-semibold tracking-[0.2em] uppercase">Sasha Aesthetics</span>
          </div>
          <div>
            <h2 className="font-heading text-4xl font-bold leading-tight mb-4">
              Your Journey to<br />Timeless Beauty
            </h2>
            <p className="text-white/60 text-base max-w-md leading-relaxed">
              You've been referred by <span className="text-white font-medium">{partnerName || "a trusted partner"}</span>. Book your consultation today.
            </p>
          </div>
          <p className="text-white/30 text-xs tracking-wide">© 2026 Sasha Aesthetic Clinic. JVC, Dubai.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Image src={LOGO_URL} alt="Sasha Aesthetics" className="w-16 h-16 rounded-full" fittingType="fill" />
          </div>

          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 border-4 border-brand-soft border-t-brand rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">Loading your referral…</p>
            </div>
          )}

          {stage === "error" && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Referral Link Invalid</h1>
              <p className="text-muted-foreground">{errorMsg}</p>
            </div>
          )}

          {stage === "success" && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
              <p className="text-muted-foreground mb-6">
                Your referral has been received. Our team at Sasha Aesthetic Clinic will contact you shortly to book your consultation.
              </p>
              <p className="text-sm text-muted-foreground">Referred by {partnerName}</p>
            </div>
          )}

          {stage === "form" && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold tracking-tight">Book Your Consultation</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Referred by <span className="font-medium text-foreground">{partnerName}</span>
                </p>
              </div>
              <form onSubmit={submit} className="bg-card border border-border p-8 shadow-sm rounded-none space-y-4">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="!rounded-none"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+971 5X XXX XXXX"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="!rounded-none"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="!rounded-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-service-of-interest-1">Service of Interest</Label>
                  <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
                    <SelectTrigger id="f-service-of-interest-1" className="!rounded-none">
                      <SelectValue placeholder="Select a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                <Button type="submit" className="w-full !rounded-none" disabled={stage === "submitting"}>
                  {stage === "submitting" ? "Submitting…" : "Submit Referral"}
                </Button>
                <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  No payment required — we'll contact you to book
                </p>
                <p className="text-[11px] text-muted-foreground/80 text-center leading-snug">
                  By submitting, you agree that Sasha Aesthetic Clinic may contact you about your enquiry.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}