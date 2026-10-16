import React, { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, XCircle, ShieldCheck, Loader2, LogOut } from "lucide-react";

export default function PendingApproval({ existing, onSubmitted }) {
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [requestedRole, setRequestedRole] = useState("user");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const status = existing?.status;

  const handleLogout = () => api.auth.logout(window.location.origin + "/login");

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const me = await api.auth.me();
      const created = await api.entities.AccessRequest.create({
        user_id: me.id,
        user_email: me.email,
        phone,
        note,
        requested_role: requestedRole,
        status: "pending",
      });
      onSubmitted?.(created);
    } catch (e) {
      setError(e.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-6">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Not Approved</h1>
          <p className="text-muted-foreground mb-8">
            Your access request to Sasha Connect was reviewed and not approved. Please contact the clinic if you believe this is an error.
          </p>
          <Button variant="outline" onClick={handleLogout} className="w-full h-12">
            <LogOut className="h-4 w-4 mr-2" /> Log out
          </Button>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-6">
            <Clock className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Awaiting Head Office Approval</h1>
          <p className="text-muted-foreground mb-8">
            Your access request has been submitted and is being reviewed by the Sasha Connect head office. You will be contacted once your account is approved.
          </p>
          {existing?.phone && <p className="text-sm text-muted-foreground mb-1">Phone: {existing.phone}</p>}
          {existing?.note && <p className="text-sm text-muted-foreground mb-6 italic">"{existing.note}"</p>}
          <Button variant="outline" onClick={handleLogout} className="w-full h-12">
            <LogOut className="h-4 w-4 mr-2" /> Log out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <ShieldCheck className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Request Access</h1>
          <p className="text-muted-foreground mt-2">
            Your account is created. Complete the form below to request access from the head office.
          </p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}
          <div className="space-y-2">
            <Label htmlFor="f-phone-1">Phone</Label>
            <Input id="f-phone-1"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 123 4567"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-i-am-a-2">I am a…</Label>
            <Select value={requestedRole} onValueChange={setRequestedRole}>
              <SelectTrigger id="f-i-am-a-2" className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Partner — I refer clients to Sasha Clinic</SelectItem>
                <SelectItem value="admin">Staff — I work at Sasha Clinic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-notes-3">Notes</Label>
            <Textarea id="f-notes-3"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us who you are (e.g. business name, partnership details)"
              rows={3}
            />
          </div>
          <Button
            onClick={submit}
            disabled={submitting}
            className="w-full h-12 bg-brand hover:bg-brand-dark"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
              </>
            ) : (
              "Submit Access Request"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}