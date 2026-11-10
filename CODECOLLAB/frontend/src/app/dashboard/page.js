"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import { clearCredentials } from "../../redux/slices/authSlice";

export default function Dashboard() {
  const { accessToken, user, authResolved } = useSelector(s => s.auth);
  const [snippets,setSnippets]=useState([]); const [sharedSnippets,setSharedSnippets]=useState([]); const [activities,setActivities]=useState([]); const [error,setError]=useState("");
  const [loggingOut,setLoggingOut]=useState(false);
  const router=useRouter(); const dispatch=useDispatch();
  useEffect(()=>{if(!authResolved)return;if(!accessToken){router.replace("/login");return;} Promise.all([api("/snippets?limit=50",{},accessToken),api("/snippets?shared=true&limit=50",{},accessToken),api("/activities",{},accessToken)]).then(([s,shared,a])=>{setSnippets(s.items);setSharedSnippets(shared.items);setActivities(a.items);}).catch(e=>setError(e.message));},[accessToken,authResolved,router]);
  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST" });
      dispatch(clearCredentials());
      router.replace("/login");
    } catch (e) {
      setError(e.message);
      setLoggingOut(false);
    }
  }
  const recentSnippets=snippets.filter(snippet=>snippet.ownerId===user?.id||snippet.visibility==="PUBLIC");
  return <main className="min-h-screen">
    <header className="border-b border-slate-800 bg-slate-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-black text-sky-400">CodeCollab</Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">{user?.name || "Developer"}</span>
          <Link href="/profile" className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800">Profile</Link>
          <button onClick={()=>router.push("/snippets/new")} className="rounded-lg bg-sky-500 px-4 py-2 font-bold text-slate-950">+ New snippet</button>
          <button onClick={logout} disabled={loggingOut} className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">{loggingOut?"Logging out...":"Log out"}</button>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-bold">Your workspace</h1>
      <p className="mt-2 text-slate-400">Your snippets and recent team activity.</p>
      {error&&<p className="mt-5 text-rose-300">{error}</p>}
      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-10">
          <div>
            <h2 className="mb-4 text-xl font-semibold">Recent snippets</h2>
            <div className="grid gap-3">
              {recentSnippets.map(snippet=><Link key={snippet.id} href={`/snippets/${snippet.id}`} className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-sky-500">
                <div className="flex justify-between gap-3"><h3 className="font-semibold">{snippet.title}</h3><span className="text-xs text-sky-300">{snippet.language}</span></div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-400">{snippet.description || "No description"}</p>
                <p className="mt-3 text-xs text-slate-500">Updated {new Date(snippet.updatedAt).toLocaleString()}</p>
              </Link>)}
              {recentSnippets.length===0&&<p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">No snippets yet. Create your first one.</p>}
            </div>
          </div>
          <div>
            <h2 className="mb-4 text-xl font-semibold">Shared with you</h2>
            <div className="grid gap-3">
              {sharedSnippets.map(snippet=>{
                const role=snippet.permissions?.[0]?.role;
                return <Link key={snippet.id} href={`/snippets/${snippet.id}`} className="rounded-xl border border-slate-800 bg-slate-900 p-5 hover:border-sky-500">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">{snippet.title}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-sky-300">{snippet.language}</span>
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">{role==="EDITOR"?"Editor":"Viewer"}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">Shared by {snippet.owner?.name || "another user"}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{snippet.description || "No description"}</p>
                </Link>;
              })}
              {sharedSnippets.length===0&&<p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-400">Snippets shared with your account will appear here.</p>}
            </div>
          </div>
        </section>
        <aside>
          <h2 className="mb-4 text-xl font-semibold">Activity feed</h2>
          <div className="space-y-3">
            {activities.map(activity=><div key={activity.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm">{activity.action.replaceAll("_"," ").toLowerCase()}</p>
              <p className="mt-1 text-xs text-slate-500">{activity.snippet?.title || activity.detail || "Workspace activity"}</p>
            </div>)}
            {activities.length===0&&<p className="text-sm text-slate-500">Your recent activity will appear here.</p>}
          </div>
        </aside>
      </div>
    </div>
  </main>;
}
