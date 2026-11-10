"use client";
import Editor from "@monaco-editor/react";
export default function CodeEditor({ value, language, onChange, readOnly = false }) {
  return <div className="overflow-hidden rounded-xl border border-slate-700">
    <Editor height="480px" theme="vs-dark" language={language || "javascript"} value={value}
      onChange={next => onChange?.(next ?? "")} options={{ readOnly, minimap: { enabled: false }, fontSize: 14, automaticLayout: true, scrollBeyondLastLine: false }} />
  </div>;
}
