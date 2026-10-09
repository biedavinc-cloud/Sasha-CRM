import React, { useState, useEffect } from "react";
import { UserCog, UserPlus, Shield, Handshake, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, Spinner, Th, Td, EmptyState } from "@/components/crm/ui";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.AccessRequest.filter({ status: "pending" }),
      ]);
      setUsers(Array.isArray(u) ? u : u.items || []);
      setRequests(Array.isArray(r) ? r : r.items || []);
    } catch (e) {
      setUsers([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    if (!email) return;
    setSaving(true);
    try {
      await base44.users.inviteUser(email, role);
      setOpen(false);
      setEmail("");
      setRole("user");
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const approve = async (req, assignedRole) => {
    const key = req.id + "-" + assignedRole;
    setActionLoading(key);
    try {
      if (req.user_id) {
        await base44.entities.User.update(req.user_id, { role: assignedRole });
      }
      await base44.entities.AccessRequest.update(req.id, {
        status: "approved",
        reviewed_by: currentUser?.id,
        reviewed_date: new Date().toISOString(),
      });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (req) => {
    const key = req.id + "-reject";
    setActionLoading(key);
    try {
      await base44.entities.AccessRequest.update(req.id, {
        status: "rejected",
        reviewed_by: currentUser?.id,
        reviewed_date: new Date().toISOString(),
      });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage staff & partner portal accounts"
        actions={
          <Button onClick={() => setOpen(true)} className="bg-brand hover:bg-brand-dark">
            <UserPlus className="h-4 w-4 mr-1.5" /> Invite User
          </Button>
        }
      />

      {requests.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 bg-brand/5 border-b border-border flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand" />
            <h2 className="font-semibold text-foreground">
              Pending Access Requests ({requests.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Requested</Th>
                  <Th>Note</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{r.user_email || "—"}</Td>
                    <Td>{r.phone || "—"}</Td>
                    <Td>
                      {r.requested_role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand">
                          <Shield className="h-3 w-3" />Staff
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-soft/40 text-brand-dark">
                          <Handshake className="h-3 w-3" />Partner
                        </span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground max-w-xs truncate">{r.note || "—"}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-8 bg-brand hover:bg-brand-dark"
                          disabled={actionLoading === r.id + "-admin"}
                          onClick={() => approve(r, "admin")}
                        >
                          {actionLoading === r.id + "-admin" ? "…" : "Approve as Staff"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={actionLoading === r.id + "-user"}
                          onClick={() => approve(r, "user")}
                        >
                          {actionLoading === r.id + "-user" ? "…" : "Approve as Partner"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive"
                          disabled={actionLoading === r.id + "-reject"}
                          onClick={() => reject(r)}
                        >
                          {actionLoading === r.id + "-reject" ? "…" : "Reject"}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No users yet"
            description="Invite staff (admin) or partner (user) accounts. Partners are linked to their partner profile separately."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <Td className="font-medium">{u.full_name || "—"}</Td>
                    <Td>{u.email}</Td>
                    <Td>
                      {u.role === "admin" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand">
                          <Shield className="h-3 w-3" />Staff (Admin)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-soft/40 text-brand-dark">
                          <Handshake className="h-3 w-3" />Partner (User)
                        </span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground">{formatDate(u.created_date)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Staff (Admin) — Back Office access</SelectItem>
                  <SelectItem value="user">Partner (User) — Partner Portal access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Invited users must still complete an access request and be approved by the head office before activation.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={invite}
              disabled={saving || !email}
              className="bg-brand hover:bg-brand-dark"
            >
              {saving ? "Inviting…" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}