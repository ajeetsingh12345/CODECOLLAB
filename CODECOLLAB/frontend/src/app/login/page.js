"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { useDispatch } from "react-redux";
import { setCredentials } from "../../redux/slices/authSlice";

export default function LoginPage() {
  const [form,setForm]=useState({email:"",password:""}); const [error,setError]=useState(""); const [busy,setBusy]=useState(false);
  const router=useRouter(); const dispatch=useDispatch();
  useEffect(()=>{const code=new URLSearchParams(window.location.search).get("oauthError");if(code){const messages={"google-not-configured":"Google login is not configured. Use email and password, or ask an administrator to configure OAuth.","google-denied":"Google login was cancelled.","google-invalid-state":"Google login could not be verified. Please try again.","google-verified-email-required":"Your Google account must have a verified email address.","google-unavailable":"Google login is temporarily unavailable. Please try again."};setError(messages[code]||"Google login failed. Please try again.");}},[]);
  async function submit(e){e.preventDefault();setBusy(true);setError("");try{const data=await api("/auth/login",{method:"POST",body:JSON.stringify(form)});dispatch(setCredentials(data));router.push("/dashboard");}catch(err){setError(err.message);}finally{setBusy(false);}}
  const apiUrl=process.env.NEXT_PUBLIC_API_URL||"http://localhost:5000/api";
  const backendUrl=apiUrl.replace(/\/api\/?$/,"");
  return <main className="flex min-h-screen items-center justify-center px-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8"><Link href="/" className="text-xl font-black text-sky-400">CodeCollab</Link><h1 className="mt-6 text-3xl font-bold">Welcome back</h1><p className="mt-2 text-slate-400">Log in to your developer workspace.</p>{error&&<p className="mt-4 rounded bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}<label className="mt-5 block text-sm">Email<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/></label><label className="mt-5 block text-sm">Password<input required type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3"/></label><button disabled={busy} className="mt-6 w-full rounded-lg bg-sky-500 py-3 font-bold text-slate-950">{busy?"Signing in...":"Log in"}</button><div className="my-4 flex items-center gap-3 text-xs text-slate-500"><span className="h-px flex-1 bg-slate-700"/><span>OR</span><span className="h-px flex-1 bg-slate-700"/></div><a href={`${backendUrl}/api/auth/google`} className="block w-full rounded-lg border border-slate-700 py-3 text-center font-semibold hover:bg-slate-800">Continue with Google</a><p className="mt-5 text-center text-sm text-slate-400">New here? <Link href="/register" className="text-sky-400">Create account</Link></p></form></main>;
}
