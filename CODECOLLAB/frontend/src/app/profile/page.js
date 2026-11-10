"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { setCredentials } from "../../redux/slices/authSlice";

export default function ProfilePage() {
  const { accessToken, user, authResolved } = useSelector(state => state.auth);
  const [form, setForm] = useState({ name: "", bio: "", avatarUrl: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!authResolved) return;
    if (!accessToken) router.replace("/login");
    else setForm({ name: user?.name || "", bio: user?.bio || "", avatarUrl: user?.avatarUrl || "" });
  }, [accessToken, authResolved, router, user]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const { user: updatedUser } = await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(form)
      }, accessToken);
      dispatch(setCredentials({ user: updatedUser, accessToken }));
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authResolved || !accessToken) return <main className="p-10 text-slate-400">Loading profile...</main>;
  return <main className="mx-auto max-w-2xl px-6 py-10">
    <Link href="/dashboard" className="text-sm text-sky-400">← Dashboard</Link>
    <h1 className="mt-5 text-3xl font-bold">Your profile</h1>
    <p className="mt-2 text-slate-400">Manage the details shown to your collaborators.</p>
    <form onSubmit={save} className="mt-8 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
      {error && <p role="alert" className="rounded bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      {saved && <p role="status" className="rounded bg-emerald-500/10 p-3 text-sm text-emerald-300">Profile updated.</p>}
      <label className="block text-sm">Name
        <input required minLength="2" maxLength="80" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/>
      </label>
      <label className="block text-sm">Email
        <input disabled value={user?.email || ""} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-500"/>
      </label>
      <label className="block text-sm">Avatar URL
        <input type="url" value={form.avatarUrl} onChange={event => setForm({ ...form, avatarUrl: event.target.value })} placeholder="https://example.com/avatar.png" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/>
      </label>
      <label className="block text-sm">Bio
        <textarea maxLength="500" rows="4" value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/>
      </label>
      <button disabled={busy} className="rounded-lg bg-sky-500 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? "Saving..." : "Save profile"}</button>
    </form>
  </main>;
}
