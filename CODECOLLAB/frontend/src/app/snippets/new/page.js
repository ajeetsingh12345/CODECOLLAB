"use client";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import CodeEditor from "../../../components/CodeEditor";
import { api } from "../../../lib/api";

export default function NewSnippet() {
  const {accessToken,authResolved}=useSelector(s=>s.auth); const router=useRouter();
  const [form,setForm]=useState({title:"Untitled snippet",description:"",language:"javascript",visibility:"PRIVATE",content:"// Start coding here\n"});
  const [error,setError]=useState("");
  useEffect(()=>{if(authResolved&&!accessToken)router.replace("/login");},[accessToken,authResolved,router]);
  async function save(){try{const result=await api("/snippets",{method:"POST",body:JSON.stringify({...form,tags:[]})},accessToken);router.push(`/snippets/${result.snippet.id}`);}catch(e){setError(e.message);}}
  if(!authResolved||!accessToken)return <main className="p-10 text-slate-400">{authResolved?"Redirecting to login...":"Restoring session..."}</main>;
  return <main className="mx-auto max-w-6xl px-6 py-8"><div className="mb-6 flex items-center justify-between"><h1 className="text-2xl font-bold">Create snippet</h1><button onClick={save} className="rounded-lg bg-sky-500 px-5 py-2 font-bold text-slate-950">Save snippet</button></div>{error&&<p className="mb-4 text-rose-300">{error}</p>}<div className="mb-4 grid gap-3 md:grid-cols-3"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-3" placeholder="Snippet title"/><select value={form.language} onChange={e=>setForm({...form,language:e.target.value})} className="rounded-lg border border-slate-700 bg-slate-900 px-3"><option>javascript</option><option>typescript</option><option>python</option><option>java</option><option>cpp</option><option>html</option><option>css</option><option>sql</option></select><select value={form.visibility} onChange={e=>setForm({...form,visibility:e.target.value})} className="rounded-lg border border-slate-700 bg-slate-900 px-3"><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option><option value="UNLISTED">Unlisted</option></select></div><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-900 p-3"/><CodeEditor value={form.content} language={form.language} onChange={content=>setForm({...form,content})}/></main>;
}
