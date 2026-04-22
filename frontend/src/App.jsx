import { useEffect, useState } from "react";

export default function App() {
  const [serverStatus, setServerStatus] = useState("checking…");

  useEffect(() => {
    fetch("/api/ping")
      .then((r) => r.json())
      .then((d) => setServerStatus(d.online ? "online" : "offline"))
      .catch(() => setServerStatus("unreachable"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">
          AnythingLLM Rebuild
        </h1>
        <p className="text-slate-400">Phase 0 — Walking Skeleton</p>
        <p className="text-sm">
          Server status:{" "}
          <span className="font-mono text-sky-400">{serverStatus}</span>
        </p>
      </div>
    </div>
  );
}
