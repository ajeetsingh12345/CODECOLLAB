import Link from "next/link";

const features = [
  ["Live collaboration", "Work together in shared code rooms with live presence."],
  ["Code reviews", "Leave line-level feedback and resolve discussions."],
  ["Version history", "Review earlier snapshots and restore a previous version."],
  ["Discover snippets", "Search code by title, language, and author."]
];

export default function Home() {
  return <main className="min-h-screen">
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <Link href="/" className="text-2xl font-black tracking-tight text-sky-400">CodeCollab<span className="text-white">.</span></Link>
      <div className="flex gap-3"><Link className="rounded-lg px-4 py-2 text-slate-300 hover:bg-slate-800" href="/login">Log in</Link><Link className="rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400" href="/register">Get started</Link></div>
    </nav>
    <section className="mx-auto grid max-w-7xl gap-12 px-6 py-24 md:grid-cols-2 md:items-center">
      <div>
        <p className="mb-5 inline-flex rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-sm text-sky-300">A workspace for developers</p>
        <h1 className="text-5xl font-black leading-tight md:text-6xl">Write code.<br/><span className="text-sky-400">Review together.</span></h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-400">Create, share, discuss, and improve code snippets with your team in one collaborative workspace.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="rounded-xl bg-sky-500 px-6 py-3 font-bold text-slate-950 hover:bg-sky-400">Create your workspace</Link><Link href="/dashboard" className="rounded-xl border border-slate-700 px-6 py-3 font-semibold hover:bg-slate-800">Open dashboard</Link></div>
      </div>
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-sky-950/30">
        <div className="mb-4 flex items-center justify-between"><div className="flex gap-2"><i className="h-3 w-3 rounded-full bg-rose-400"/><i className="h-3 w-3 rounded-full bg-amber-300"/><i className="h-3 w-3 rounded-full bg-emerald-400"/></div><span className="text-xs text-slate-500">utils.js · JavaScript</span></div>
        <pre className="overflow-x-auto text-sm leading-7"><code><span className="text-fuchsia-300">export function</span> <span className="text-sky-300">mergeProfiles</span>(users) {"{"}{"\n"}  <span className="text-fuchsia-300">return</span> users.map((user) =&gt; ({"{"}{"\n"}    ...user,{"\n"}    active: <span className="text-amber-200">true</span>,{"\n"}  {"}"}));{"\n"}{"}"}</code></pre>
        <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400"><span>● Ajeet is editing</span><span>2 collaborators online</span></div>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
      {features.map(([title, body]) => <article key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="font-bold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></article>)}
    </section>
  </main>;
}
