"use client";
import { use, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import CodeEditor from "../../../components/CodeEditor";
import { api } from "../../../lib/api";

export default function SnippetPage({ params }) {
  const { id } = use(params);
  const { accessToken, authResolved, user } = useSelector(state => state.auth);
  const router = useRouter();
  const socketRef = useRef(null);
  const changeTimer = useRef(null);
  const [snippet, setSnippet] = useState(null);
  const [comments, setComments] = useState([]);
  const [versions, setVersions] = useState([]);
  const [comment, setComment] = useState("");
  const [line, setLine] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("VIEWER");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authResolved) return;
    if (!accessToken) {
      router.replace("/login");
      return;
    }
    Promise.all([
      api(`/snippets/${id}`, {}, accessToken),
      api(`/snippets/${id}/comments`, {}, accessToken),
      api(`/snippets/${id}/versions`, {}, accessToken)
    ]).then(([snippetResult, commentResult, versionResult]) => {
      setSnippet(snippetResult.snippet);
      setComments(commentResult.comments);
      setVersions(versionResult.items);
    }).catch(requestError => setError(requestError.message));
  }, [id, accessToken, authResolved, router]);

  useEffect(() => {
    if (!accessToken || !id) return;
    setSocketStatus("connecting");
    const client = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000", {
      auth: { token: accessToken }
    });
    socketRef.current = client;
    client.on("connect", () => {
      setSocketStatus("joining");
      client.emit("snippet:join", { snippetId: id });
    });
    client.on("snippet:joined", () => setSocketStatus("connected"));
    client.on("snippet:change", payload => {
      setSnippet(current => current ? { ...current, content: payload.content } : current);
      setDirty(true);
      setNotice("A collaborator changed this snippet. Save to persist the latest content.");
    });
    client.on("snippet:error", payload => setError(payload.message || "Collaboration error"));
    client.on("connect_error", () => setSocketStatus("disconnected"));
    client.on("disconnect", () => setSocketStatus("disconnected"));
    return () => {
      if (changeTimer.current) window.clearTimeout(changeTimer.current);
      client.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, id]);

  const canEdit = Boolean(
    snippet &&
    (snippet.ownerId === user?.id ||
      snippet.permissions?.some(permission => permission.userId === user?.id && permission.role === "EDITOR"))
  );
  const canDelete = Boolean(snippet && (snippet.ownerId === user?.id || user?.role === "ADMIN"));
  const canShare = Boolean(snippet && snippet.ownerId === user?.id);

  function updateSnippet(changes) {
    setSnippet(current => ({ ...current, ...changes }));
    setDirty(true);
    setNotice("");
  }

  function onContentChange(content) {
    updateSnippet({ content });
    if (changeTimer.current) window.clearTimeout(changeTimer.current);
    changeTimer.current = window.setTimeout(() => {
      if (socketStatus === "connected") {
        socketRef.current?.emit("snippet:change", { snippetId: id, content });
      }
    }, 150);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await api(`/snippets/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: snippet.title,
          content: snippet.content,
          language: snippet.language
        })
      }, accessToken);
      setSnippet(current => ({ ...current, updatedAt: result.snippet.updatedAt }));
      setDirty(false);
      setNotice("Changes saved.");
      const versionResult = await api(`/snippets/${id}/versions`, {}, accessToken);
      setVersions(versionResult.items);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function addComment(event) {
    event.preventDefault();
    try {
      const result = await api(`/snippets/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment, lineNumber: line ? Number(line) : null })
      }, accessToken);
      setComments(current => [...current, result.comment]);
      setComment("");
      setLine("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function share(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await api(`/snippets/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail, role: shareRole })
      }, accessToken);
      const result = await api(`/snippets/${id}`, {}, accessToken);
      setSnippet(current => ({ ...current, ...result.snippet }));
      setShareEmail("");
      setNotice("Snippet access updated.");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function restoreVersion(versionId) {
    setError("");
    try {
      const result = await api(`/snippets/${id}/versions/${versionId}/restore`, {
        method: "POST"
      }, accessToken);
      setSnippet(result.snippet);
      setDirty(false);
      setNotice("Version restored and saved.");
      socketRef.current?.emit("snippet:change", { snippetId: id, content: result.snippet.content });
      const versionResult = await api(`/snippets/${id}/versions`, {}, accessToken);
      setVersions(versionResult.items);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteSnippet() {
    if (!window.confirm("Delete this snippet and its version history?")) return;
    try {
      await api(`/snippets/${id}`, { method: "DELETE" }, accessToken);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (!snippet) return <main className="p-10 text-slate-400">{error || "Loading snippet..."}</main>;
  return <main className="mx-auto max-w-7xl px-6 py-8">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <button onClick={() => router.push("/dashboard")} className="mb-2 text-sm text-sky-400">← Dashboard</button>
        <p className="text-sm text-slate-400">{snippet.language} · Owner: {snippet.owner?.name}</p>
        {canEdit
          ? <input value={snippet.title} onChange={event => updateSnippet({ title: event.target.value })} aria-label="Snippet title" className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-2xl font-bold"/>
          : <h1 className="mt-1 text-2xl font-bold">{snippet.title}</h1>}
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <button onClick={save} disabled={busy || !dirty} className="rounded-lg bg-sky-500 px-5 py-2 font-bold text-slate-950 disabled:opacity-50">{busy ? "Saving..." : dirty ? "Save changes" : "Saved"}</button>}
        {canDelete && <button onClick={deleteSnippet} className="rounded-lg border border-rose-800 px-4 py-2 font-semibold text-rose-300">Delete</button>}
      </div>
    </div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className={socketStatus === "connected" ? "text-emerald-300" : "text-amber-300"}>Collaboration: {socketStatus}</span>
      <span className="text-slate-500">Live updates are last-write-wins; save to persist changes.</span>
    </div>
    {error && <p role="alert" className="mb-3 text-rose-300">{error}</p>}
    {notice && <p role="status" className="mb-3 text-emerald-300">{notice}</p>}
    {canEdit && <label className="mb-3 block max-w-xs text-sm text-slate-400">Language
      <select value={snippet.language} onChange={event => updateSnippet({ language: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2">
        {["javascript", "typescript", "python", "java", "cpp", "html", "css", "sql", "json", "go", "rust"].map(language => <option key={language}>{language}</option>)}
      </select>
    </label>}
    <CodeEditor value={snippet.content} language={snippet.language} readOnly={!canEdit} onChange={onContentChange}/>
    <section className="mt-8 grid gap-8 lg:grid-cols-3">
      <div>
        <h2 className="mb-3 text-xl font-bold">Review discussion</h2>
        <form onSubmit={addComment} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <input value={line} onChange={event => setLine(event.target.value)} type="number" min="1" placeholder="Line number (optional)" className="mb-3 w-full rounded border border-slate-700 bg-slate-950 p-2"/>
          <textarea required value={comment} onChange={event => setComment(event.target.value)} placeholder="Leave a review comment..." className="w-full rounded border border-slate-700 bg-slate-950 p-3"/>
          <button className="mt-3 rounded bg-sky-500 px-4 py-2 font-semibold text-slate-950">Add comment</button>
        </form>
        <div className="mt-4 space-y-3">{comments.map(item => <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex justify-between text-sm"><b>{item.user.name}</b><span className="text-slate-500">{item.lineNumber ? `Line ${item.lineNumber}` : "General"}</span></div>
          <p className="mt-2 text-slate-300">{item.body}</p>
          {item.replies?.map(reply => <p key={reply.id} className="ml-4 mt-3 border-l border-slate-700 pl-3 text-sm text-slate-400">{reply.user.name}: {reply.body}</p>)}
        </article>)}</div>
      </div>
      <div>
        <h2 className="mb-3 text-xl font-bold">Version history</h2>
        <div className="space-y-2">{versions.map(version => <article key={version.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-sm font-semibold">{version.message || "Saved version"}</p>
          <p className="mt-1 text-xs text-slate-500">{version.user.name} · {new Date(version.createdAt).toLocaleString()}</p>
          {canEdit && <button onClick={() => restoreVersion(version.id)} className="mt-2 text-xs text-sky-400 hover:underline">Restore this version</button>}
        </article>)}</div>
      </div>
      <div>
        <h2 className="mb-3 text-xl font-bold">Snippet details</h2>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">
          <p>{snippet.description || "No description provided."}</p>
          <p className="mt-4">Visibility: {snippet.visibility}</p>
          <p className="mt-2">Created: {new Date(snippet.createdAt).toLocaleString()}</p>
          <p className="mt-2">Updated: {new Date(snippet.updatedAt).toLocaleString()}</p>
          {canShare && <>
            <h3 className="mt-5 font-semibold text-slate-200">Manage access</h3>
            <form onSubmit={share} className="mt-2 space-y-2">
              <input required type="email" value={shareEmail} onChange={event => setShareEmail(event.target.value)} placeholder="Collaborator email" className="w-full rounded border border-slate-700 bg-slate-950 p-2"/>
              <select value={shareRole} onChange={event => setShareRole(event.target.value)} className="w-full rounded border border-slate-700 bg-slate-950 p-2">
                <option value="VIEWER">Viewer</option><option value="EDITOR">Editor</option>
              </select>
              <button className="rounded bg-slate-700 px-3 py-2 text-slate-100">Share snippet</button>
            </form>
            <ul className="mt-3 space-y-1">{snippet.permissions?.map(permission => <li key={permission.id}>{permission.user.email} — {permission.role.toLowerCase()}</li>)}</ul>
          </>}
        </div>
      </div>
    </section>
  </main>;
}
