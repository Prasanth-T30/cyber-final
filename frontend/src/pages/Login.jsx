import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, AlertCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

/* ─── Main Login Page ────────────────────────────────────────────────────── */
export default function Login() {
  const { login, loading, error, clearError } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();

  const [form, setForm]           = useState({ username: "", password: "" });
  const [showPwd, setShowPwd]     = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = "Username is required";
    if (!form.password)        e.password = "Password is required";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    clearError();
    if (!validate()) return;
    const res = await login(form.username.trim(), form.password);
    if (res.ok) navigate("/", { replace: true });
  };

  const set = (field) => (e) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setFieldErrors(f => ({ ...f, [field]: undefined }));
    clearError();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "#020b07" }}
    >
      {/* Subtle scanline texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.012) 2px, rgba(0,255,100,0.012) 4px)",
        }}
      />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-2 rounded-full border transition-colors"
        style={{
          background: "rgba(0,20,10,0.8)",
          borderColor: "#00ff4422",
          color: "#00ff88",
        }}
        title="Toggle theme"
      >
        {isDark ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </button>

      {/* Main card — simple fade-in */}
      <div
        className="relative z-20 w-full max-w-sm"
        style={{ animation: "fadeIn 0.4s ease both" }}
      >
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg,#003d1a,#001a0d)",
              border: "1px solid #00ff4433",
            }}
          >
            <ShieldAlert size={36} style={{ color: "#00ff88" }} />
          </div>

          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: "#00ff88", fontFamily: "monospace", letterSpacing: "0.05em" }}
          >
            FusionGuardNet
          </h1>
          <p className="text-xs font-mono" style={{ color: "#00cc6688" }}>
            ◈ ADVANCED MULTIMODAL IDS ◈
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: "rgba(2,14,8,0.95)",
            border: "1px solid #00ff4422",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono" style={{ color: "#00ff88" }}>SYSTEM AUTHENTICATION</span>
            <div className="flex-1 h-px" style={{ background: "#00ff4422" }} />
          </div>

          <h2 className="text-lg font-semibold mb-6" style={{ color: "#e0ffe8", fontFamily: "monospace" }}>
            Sign in to your account
          </h2>

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg p-3 mb-5 border"
              style={{ background: "rgba(239,68,68,0.1)", borderColor: "#ef444433", color: "#fca5a5" }}
            >
              <AlertCircle size={16} className="shrink-0" />
              <p className="text-sm font-mono">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Username */}
            <div>
              <label className="block text-xs font-mono mb-2" style={{ color: "#00cc88" }}>
                &gt; USERNAME
              </label>
              <input
                type="text"
                className="w-full rounded-lg px-3 py-2.5 text-sm font-mono outline-none transition-all"
                style={{
                  background: "rgba(0,255,100,0.04)",
                  border: `1px solid ${fieldErrors.username ? "#ef4444" : "#00ff4433"}`,
                  color: "#00ff88",
                  caretColor: "#00ff88",
                }}
                onFocus={e => { e.target.style.borderColor = fieldErrors.username ? "#ef4444" : "#00ff88"; e.target.style.boxShadow = "0 0 12px #00ff4422"; }}
                onBlur={e  => { e.target.style.borderColor = fieldErrors.username ? "#ef4444" : "#00ff4433"; e.target.style.boxShadow = "none"; }}
                placeholder="analyst_01"
                value={form.username}
                onChange={set("username")}
                autoComplete="username"
                autoFocus
              />
              {fieldErrors.username && (
                <p className="text-xs font-mono mt-1" style={{ color: "#ef4444" }}>⚠ {fieldErrors.username}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-mono mb-2" style={{ color: "#00cc88" }}>
                &gt; PASSWORD
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm font-mono outline-none transition-all"
                  style={{
                    background: "rgba(0,255,100,0.04)",
                    border: `1px solid ${fieldErrors.password ? "#ef4444" : "#00ff4433"}`,
                    color: "#00ff88",
                    caretColor: "#00ff88",
                  }}
                  onFocus={e => { e.target.style.borderColor = fieldErrors.password ? "#ef4444" : "#00ff88"; e.target.style.boxShadow = "0 0 12px #00ff4422"; }}
                  onBlur={e  => { e.target.style.borderColor = fieldErrors.password ? "#ef4444" : "#00ff4433"; e.target.style.boxShadow = "none"; }}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute inset-y-0 right-0 px-3"
                  style={{ color: "#00ff6688" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#00ff88"}
                  onMouseLeave={e => e.currentTarget.style.color = "#00ff6688"}
                >
                  {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs font-mono mt-1" style={{ color: "#ef4444" }}>⚠ {fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-mono font-semibold transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg,#006633,#003d1a)",
                color: "#00ff88",
                border: "1px solid #00ff4444",
                letterSpacing: "0.1em",
                boxShadow: "0 0 20px #00ff4422",
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.boxShadow = "0 0 30px #00ff4466"; e.currentTarget.style.background = "linear-gradient(135deg,#008844,#004d22)"; }}}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px #00ff4422"; e.currentTarget.style.background = "linear-gradient(135deg,#006633,#003d1a)"; }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" />AUTHENTICATING…</>
              ) : (
                <>▶ SIGN IN</>
              )}
            </button>
          </form>

          {/* Footer line */}
          <div className="flex items-center gap-2 mt-6">
            <div className="flex-1 h-px" style={{ background: "#00ff4411" }} />
            <span className="text-xs font-mono" style={{ color: "#00ff4444" }}>SECURE CHANNEL</span>
            <div className="flex-1 h-px" style={{ background: "#00ff4411" }} />
          </div>
        </div>

        {/* Register link */}
        <p className="text-center text-xs font-mono mt-5" style={{ color: "#00cc6688" }}>
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold transition-colors"
            style={{ color: "#00ff88" }}
            onMouseEnter={e => e.currentTarget.style.color = "#66ffaa"}
            onMouseLeave={e => e.currentTarget.style.color = "#00ff88"}
          >
            Create one
          </Link>
        </p>

        {/* Status bar */}
        <div
          className="mt-4 rounded-lg px-4 py-2 flex items-center justify-between"
          style={{ background: "rgba(0,255,100,0.04)", border: "1px solid #00ff4411" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono" style={{ color: "#00cc6688" }}>SYSTEMS ONLINE</span>
          </div>
          <span className="text-xs font-mono" style={{ color: "#00cc6644" }}>TLS 1.3 ◈ AES-256</span>
        </div>
      </div>
    </div>
  );
}
