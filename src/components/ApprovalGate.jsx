import React, { useState, useEffect } from "react";
import { api } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";
import PendingApproval from "@/components/PendingApproval";

export default function ApprovalGate({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const [request, setRequest] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role === "admin") {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const reqs = await api.entities.AccessRequest.filter({ user_id: user.id });
        let req = reqs[0] || null;
        if (!req || req.status === "pending") {
          // an account created by head office for a partner is approved by definition
          try {
            const linked = await api.entities.Partner.filter({ user_id: user.id }, { limit: 1 });
            if (linked.length) req = { ...(req || {}), status: "approved" };
          } catch { /* not approved yet */ }
        }
        setRequest(req);
      } catch (e) {
        setRequest(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (isLoadingAuth || loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-soft border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated or admin → pass through to routes
  if (!user || user.role === "admin") return children;

  // Non-admin: must have an approved access request
  if (!request || request.status === "pending" || request.status === "rejected") {
    return <PendingApproval existing={request} onSubmitted={setRequest} />;
  }

  return children;
}