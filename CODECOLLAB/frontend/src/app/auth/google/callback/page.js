"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restoreSession } from "../../../../lib/api";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    restoreSession()
      .then(credentials => {
        if (active && credentials) router.replace("/dashboard");
        else if (active) router.replace("/login?oauthError=google-unavailable");
      })
      .catch(() => {
        if (active) setError("Unable to complete Google sign-in. Please return to login and try again.");
      });
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-screen items-center justify-center px-5 text-center text-slate-300">
    {error || "Finishing Google sign-in..."}
  </main>;
}
