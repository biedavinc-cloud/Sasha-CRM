import React, { useState } from "react";
import { KeyRound, Check } from "lucide-react";
import { api } from "@/api/client";
import { Card } from "@/components/crm/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// Lets any signed-in user change their own password (other devices are signed out).
export default function ChangePassword() {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDone(false); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (f.next.length < 8) return setError("The new password must be at least 8 characters.");
    if (f.next !== f.confirm) return setError("The new passwords do not match.");
    setBusy(true);
    try {
      await api.auth.changePassword(f.current, f.next);
      setF({ current: "", next: "", confirm: "" });
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not change the password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4"><KeyRound className="h-4 w-4 text-brand" /><h3 className="text-sm font-semibold">Change password</h3></div>
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div><Label htmlFor="pw-current">Current password</Label><Input id="pw-current" type="password" autoComplete="current-password" value={f.current} onChange={(e) => set("current", e.target.value)} required /></div>
        <div><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => set("next", e.target.value)} required /></div>
        <div><Label htmlFor="pw-confirm">Confirm new password</Label><Input id="pw-confirm" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} required /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {done && <p role="status" className="text-sm text-emerald-600 flex items-center gap-1.5"><Check className="h-4 w-4" />Password changed. Other devices were signed out.</p>}
        <Button type="submit" disabled={busy} className="bg-brand hover:bg-brand-dark">{busy ? "Saving…" : "Change password"}</Button>
      </form>
    </Card>
  );
}
