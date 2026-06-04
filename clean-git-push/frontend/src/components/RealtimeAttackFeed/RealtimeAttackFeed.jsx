/**
 * FusionGuardNet – RealtimeAttackFeed
 * Live terminal-style attack feed — shows attacks only, no timers.
 */
import { useEffect, useRef, useState } from "react";
import { useAlertsContext } from "@/contexts/AlertsContext";
import { attackIcon } from "@/utils/helpers";
import { Radio, ShieldAlert } from "lucide-react";

const SEV_STYLE = {
  critical: { bar: "bg-red-500",    badge: "bg-red-500/20 text-red-400 border border-red-500/40",    glow: "shadow-red-500/30"    },
  high:     { bar: "bg-orange-500", badge: "bg-orange-500/20 text-orange-400 border border-orange-500/40", glow: "shadow-orange-500/30" },
  medium:   { bar: "bg-yellow-400", badge: "bg-yellow-400/20 text-yellow-300 border border-yellow-400/40", glow: "shadow-yellow-400/30" },
  low:      { bar: "bg-blue-400",   badge: "bg-blue-400/20 text-blue-300 border border-blue-400/40",   glow: "shadow-blue-400/30"   },
};

function AttackRow({ alert, isNew }) {
  const sev   = alert.severity || "low";
  const style = SEV_STYLE[sev] || SEV_STYLE.low;

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-700/60
        bg-gray-900/80 font-mono text-xs transition-all duration-500
        ${isNew ? `ring-1 ring-cyan-400/60 shadow-lg ${style.glow} animate-pulse-once` : ""}
      `}
    >
      {/* Severity bar */}
      <div className={`w-1 self-stretch rounded-full shrink-0 ${style.bar}`} />

      {/* Icon + type */}
      <span className="text-base shrink-0">{attackIcon(alert.attack_type)}</span>
      <span className="text-gray-100 w-28 truncate shrink-0">{alert.attack_type}</span>

      {/* IPs */}
      <span className="text-cyan-400 truncate flex-1">
        {alert.src_ip}
        <span className="text-gray-500 mx-1">→</span>
        <span className="text-gray-300">{alert.dst_ip}</span>
      </span>

      {/* Details */}
      {alert.details && (
        <span className="text-gray-500 truncate max-w-xs hidden lg:block">{alert.details}</span>
      )}

      {/* Severity badge */}
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase shrink-0 ${style.badge}`}>
        {sev}
      </span>

      {/* Confidence */}
      <span className="text-green-400 w-10 text-right shrink-0">
        {(alert.confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}

export default function RealtimeAttackFeed() {
  const { alerts, connected, lastEvent } = useAlertsContext();
  const [newId, setNewId] = useState(null);
  const listRef = useRef(null);

  // Flash newest alert
  useEffect(() => {
    if (!lastEvent) return;
    setNewId(lastEvent.id);
    const t = setTimeout(() => setNewId(null), 2500);
    return () => clearTimeout(t);
  }, [lastEvent]);

  const feed = alerts.slice(0, 40);

  return (
    <div className="card p-0 overflow-hidden bg-gray-950 border border-gray-700/60">
      {/* Terminal header bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-700/60">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <Radio size={13} className={connected ? "text-green-400 animate-pulse" : "text-red-500"} />
        <span className="text-gray-300 text-xs font-mono font-semibold tracking-wide flex-1">
          LIVE THREAT FEED — FusionGuardNet
        </span>
        <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
          <ShieldAlert size={11} className="text-cyan-400" />
          <span className="text-cyan-400">MONITORING ACTIVE</span>
          <span className="text-gray-600 mx-1">|</span>
          <span>{feed.length} alerts</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-900/50 border-b border-gray-700/40 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
        <div className="w-1 shrink-0" />
        <span className="w-4 shrink-0" />
        <span className="w-28 shrink-0">Attack Type</span>
        <span className="flex-1">Source → Destination</span>
        <span className="hidden lg:block max-w-xs">Details</span>
        <span className="w-16 shrink-0 text-center">Severity</span>
        <span className="w-10 text-right shrink-0">Conf.</span>
      </div>

      {/* Feed list */}
      <div
        ref={listRef}
        className="p-3 space-y-1.5 max-h-[420px] overflow-y-auto"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#374151 transparent" }}
      >
        {feed.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-mono text-sm animate-pulse">
            Awaiting attack data…
          </div>
        ) : (
          feed.map(a => (
            <AttackRow key={a.id} alert={a} isNew={a.id === newId} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-900/50 border-t border-gray-700/40 flex items-center justify-between text-[10px] font-mono text-gray-600">
        <span>5 attack types · CNN + LSTM + RF fusion detection</span>
        <span className={connected ? "text-green-500" : "text-red-500"}>
          ● {connected ? "WebSocket connected" : "Reconnecting…"}
        </span>
      </div>
    </div>
  );
}
