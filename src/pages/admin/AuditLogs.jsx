import React, { useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { useCollection } from "@/hooks/crm";
import { PageHeader, EmptyState, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { formatDateTime } from "@/lib/format";
import { Input } from "@/components/ui/input";

export default function AuditLogs() {
  const { items: logs, loading } = useCollection("AuditLog", {}, { sort: "-created_date", limit: 2000 });
  const [search, setSearch] = useState("");
  const filtered = logs.filter((l) => (l.action || "").toLowerCase().includes(search.toLowerCase()) || (l.entity || "").toLowerCase().includes(search.toLowerCase()) || (l.details || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Immutable record of sensitive actions" />
      <div className="relative mb-4 max-w-sm">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search action, entity, details…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card className="overflow-hidden">
        {loading ? <Spinner /> : filtered.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries yet" description="Commission approvals, payouts and partner changes are logged here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50"><tr><Th>Action</Th><Th>Entity</Th><Th>Details</Th><Th>User</Th><Th>When</Th></tr></thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/30">
                    <Td><span className="font-medium capitalize">{(l.action || "").replace(/_/g, " ")}</span></Td>
                    <Td className="text-muted-foreground">{l.entity}{l.entity_id ? ` · ${l.entity_id.slice(-6)}` : ""}</Td>
                    <Td className="text-muted-foreground max-w-xs truncate">{l.details || "—"}</Td>
                    <Td className="text-muted-foreground">{l.user_email || "system"}</Td>
                    <Td className="text-muted-foreground">{formatDateTime(l.created_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}