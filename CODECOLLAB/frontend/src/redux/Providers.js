"use client";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { restoreSession } from "../lib/api";

export function Providers({ children }) {
  useEffect(() => {
    restoreSession().catch(error => {
      console.error("Unable to restore the current session:", error);
    });
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
