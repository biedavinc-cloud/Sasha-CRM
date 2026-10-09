import React, { useState, useEffect, useCallback } from "react";
import { Github, ExternalLink, Upload, Plus, Trash2, MessageSquare, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { PageHeader, Card, Spinner, Th, Td } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

export default function GitHubPage() {
  const [owner, setOwner] = useState("biedavinc-cloud");
  const [repo, setRepo] = useState("Sasha-CRM");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [commitMessage, setCommitMessage] = useState("");
  const [files, setFiles] = useState([{ path: "", content: "" }]);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("getGitHubIssues", { owner, repo });
      setIssues(res.data.issues || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to fetch issues");
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleAddFile = () => setFiles([...files, { path: "", content: "" }]);
  const handleRemoveFile = (idx) => setFiles(files.filter((_, i) => i !== idx));
  const handleFileChange = (idx, field, value) => {
    const updated = [...files];
    updated[idx][field] = value;
    setFiles(updated);
  };

  const handlePush = async () => {
    const validFiles = files.filter((f) => f.path.trim() && f.content.trim());
    if (!commitMessage.trim() || validFiles.length === 0) return;
    setPushing(true);
    setPushResult(null);
    try {
      const res = await base44.functions.invoke("pushToGitHub", {
        owner, repo, branch: "main",
        message: commitMessage,
        files: validFiles,
      });
      setPushResult(res.data);
      setCommitMessage("");
      setFiles([{ path: "", content: "" }]);
    } catch (err) {
      setPushResult({ error: err.response?.data?.error || err.message || "Push failed" });
    } finally {
      setPushing(false);
    }
  };

  const canPush = !pushing && commitMessage.trim() && files.some((f) => f.path.trim() && f.content.trim());

  return (
    <div>
      <PageHeader title="GitHub" subtitle="Open issues & code sync" />

      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1 block text-xs">Owner</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Repository</Label>
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} className="w-48" />
          </div>
          <Button onClick={fetchIssues} disabled={loading}>
            <Github className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Open Issues
            {!loading && <span className="text-xs text-muted-foreground">({issues.length})</span>}
          </h3>
          <a href={`https://github.com/${owner}/${repo}/issues`} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline flex items-center gap-1">
            View on GitHub <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {loading ? (
          <Spinner />
        ) : error ? (
          <div className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No open issues.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <Th>#</Th>
                  <Th>Title</Th>
                  <Th>Labels</Th>
                  <Th>Assignee</Th>
                  <Th className="text-center">Comments</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {issues.map((issue) => (
                  <tr key={issue.number} className="hover:bg-muted/30">
                    <Td className="font-mono text-xs">#{issue.number}</Td>
                    <Td>
                      <a href={issue.html_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-brand hover:underline flex items-center gap-1">
                        {issue.title} <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {issue.labels.map((label) => (
                          <span key={label} className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{label}</span>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-sm">{issue.assignee || "—"}</Td>
                    <Td className="text-sm text-center">{issue.comments}</Td>
                    <Td className="text-muted-foreground text-sm">{formatDate(issue.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4" /> Push Files to GitHub
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="mb-1 block text-xs">Commit Message</Label>
            <Input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="e.g. Update dashboard component" />
          </div>
          {files.map((file, idx) => (
            <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Input value={file.path} onChange={(e) => handleFileChange(idx, "path", e.target.value)} placeholder="src/path/to/file.jsx" className="flex-1" />
                {files.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea value={file.content} onChange={(e) => handleFileChange(idx, "content", e.target.value)} placeholder="File content..." rows={6} className="font-mono text-xs" />
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleAddFile}>
              <Plus className="h-4 w-4" /> Add File
            </Button>
            <Button onClick={handlePush} disabled={!canPush}>
              <Upload className="h-4 w-4" /> {pushing ? "Pushing..." : "Push to GitHub"}
            </Button>
          </div>
          {pushResult?.error && <p className="text-sm text-destructive">{pushResult.error}</p>}
          {pushResult?.success && (
            <div className="text-sm text-green-600">
              Pushed {pushResult.filesPushed} file(s).{" "}
              <a href={pushResult.commit.url} target="_blank" rel="noreferrer" className="underline">View commit</a>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}