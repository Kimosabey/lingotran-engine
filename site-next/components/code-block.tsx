"use client";

import { useState } from "react";

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-faint bg-code-bg text-code-text">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-code-cmt">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-white/15 px-2 py-1 font-mono text-[11px] text-code-text/80 transition-colors hover:bg-white/10"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
