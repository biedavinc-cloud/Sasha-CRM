import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Shows login details once (e-mail + temporary password) so head office can hand them to the person.
export default function TempPasswordDialog({ creds, onClose, title = "Login details" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Email: ${creds.email}\nTemporary password: ${creds.password}`); } catch { /* clipboard unavailable */ }
    setCopied(true);
  };
  return (
    <Dialog open={!!creds} onOpenChange={(o) => { if (!o) { setCopied(false); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        {creds && (
          <>
            <p className="text-sm text-muted-foreground">E-mail could not be sent, so here is a temporary password for <span className="font-medium text-foreground">{creds.email}</span>. It is shown only once.</p>
            <code data-testid="temp-password" className="block bg-muted px-4 py-3 rounded-xl text-base font-semibold tracking-wide text-center select-all">{creds.password}</code>
            <p className="text-xs text-muted-foreground">Share it privately. They can change it from their profile after signing in.</p>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={copy}>{copied ? "Copied" : "Copy details"}</Button>
          <Button onClick={() => { setCopied(false); onClose(); }} className="bg-brand hover:bg-brand-dark">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
