"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useDispatch } from "react-redux";
import { setCredentials } from "../../redux/slices/authSlice";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter(); const dispatch = useDispatch();
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { const data = await api("/auth/register", { method: "POST", body: JSON.stringify(form) }); dispatch(setCredentials(data)); router.push("/dashboard"); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center px-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"><Link href="/" className="text-xl font-black text-sky-400">CodeCollab</Link><h1 className="mt-6 text-3xl font-bold">Create account</h1><p className="mt-2 text-slate-400">Start sharing code with your team.</p>{error && <p className="mt-4 rounded bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}{[["name","Name","text"],["email","Email","email"],["password","Password","password"]].map(([key,label,type])=><label key={key} className="mt-5 block text-sm text-slate-300">{label}<input required type={type} minLength={key==="password"?8:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 outline-none focus:border-sky-400"/></label>)}<button disabled={busy} className="mt-6 w-full rounded-lg bg-sky-500 py-3 font-bold text-slate-950 disabled:opacity-50">{busy?"Creating...":"Create account"}</button><p className="mt-5 text-center text-sm text-slate-400">Already registered? <Link href="/login" className="text-sky-400">Log in</Link></p></form></main>;
}
