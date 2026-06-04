import ThreatStats from "@/components/ThreatStats/ThreatStats";
import NetworkMap   from "@/components/NetworkMap/NetworkMap";

/* ── Attack knowledge base ───────────────────────────────────────────────── */
const ATTACKS = [
  {
    name: "DDoS",
    icon: "💥",
    color: { border: "border-red-400", badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
    description:
      "A Distributed Denial-of-Service (DDoS) attack floods a target server, service, or network with massive volumes of internet traffic from many compromised sources simultaneously, making it unavailable to legitimate users.",
    cause:
      "Attackers leverage botnets — networks of thousands of infected machines — to generate traffic far beyond what a single machine could produce. Common vectors include SYN floods, UDP amplification, and HTTP request floods that exhaust the target's bandwidth, CPU, or connection table.",
    purpose:
      "To disrupt service availability — either as a ransom tactic, competitive sabotage, hacktivism, or as a diversion while a secondary attack is carried out elsewhere. Large-scale attacks can cause financial losses of thousands of dollars per minute of downtime.",
    indicators: ["Sudden spike in inbound traffic volume", "High SYN ratio > 0.85 in packet flows", "Traffic arriving from many geographic regions simultaneously", "Service unresponsive or extremely slow for all users"],
  },
  {
    name: "Port Scan",
    icon: "🔍",
    color: { border: "border-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500" },
    description:
      "Port scanning is a reconnaissance technique where an attacker systematically probes a target host to discover open TCP/UDP ports, running services, and OS version — building a complete map of the attack surface before launching an exploit.",
    cause:
      "Attackers send packets to a range of ports and analyse the responses: an open port replies with SYN-ACK, a closed port sends RST, and a filtered port gives no reply. Tools like Nmap can sweep thousands of ports per second and fingerprint the OS from TCP stack behaviour.",
    purpose:
      "Port scanning itself causes no damage but is almost always a precursor to a targeted attack. Results help the attacker identify exploitable services (SSH on 22, RDP on 3389), unpatched software versions, or misconfigured firewalls before launching the real exploit.",
    indicators: ["High unique destination port count from a single source IP", "Low-payload packets probing varied ports rapidly", "TCP packets with unusual flag combinations (NULL, FIN, XMAS)", "RTT patterns consistent with automated scanning tools"],
  },
  {
    name: "Brute Force",
    icon: "🔑",
    color: { border: "border-yellow-400", badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", dot: "bg-yellow-500" },
    description:
      "A brute force attack systematically tries every possible username/password combination — or a dictionary of common credentials — against an authentication endpoint until valid credentials are found and access is gained.",
    cause:
      "Authentication services exposed to the internet with no rate limiting or account lockout are vulnerable. Attackers use credential lists from previous data breaches (credential stuffing) or algorithmically generated combinations to automate thousands of login attempts per second.",
    purpose:
      "To gain unauthorised access to systems, accounts, or encrypted data. Once inside, attackers steal sensitive data, install backdoors, escalate privileges, or use the compromised account as a pivot point to move laterally across the network to higher-value targets.",
    indicators: ["High failed login count from a single IP in a short window", "Rapid sequential authentication requests to port 22, 3389, or 21", "Multiple distinct usernames targeted in the same session", "RST flag on most connections indicating failed attempts"],
  },
  {
    name: "Malware",
    icon: "🦠",
    color: { border: "border-purple-400", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500" },
    description:
      "Malware (malicious software) includes trojans, ransomware, spyware, worms, and botnet agents installed on victim machines without consent. Network-level detection identifies the C2 beacons, lateral movement, and data exfiltration traffic these programs generate.",
    cause:
      "Infection vectors include phishing emails, drive-by downloads, malicious USB devices, supply-chain attacks, and exploitation of unpatched vulnerabilities. Once installed, malware establishes persistence and connects to attacker-controlled Command & Control (C2) servers for instructions.",
    purpose:
      "Purposes vary by malware family: ransomware encrypts data for extortion; spyware silently exfiltrates credentials or intellectual property; botnets conscript machines for DDoS or spam; cryptominers steal CPU cycles. All share the goal of monetising unauthorised access to the host.",
    indicators: ["Periodic outbound connections to unusual external IPs (C2 beacons)", "Encrypted traffic on non-standard or high-numbered ports", "Lateral movement packets between internal subnet hosts", "Unusual DNS queries or DNS tunnelling patterns"],
  },
  {
    name: "SQL Injection",
    icon: "💉",
    color: { border: "border-pink-400", badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", dot: "bg-pink-500" },
    description:
      "SQL Injection (SQLi) inserts malicious SQL statements into input fields that are executed by the backend database, allowing attackers to bypass authentication, read or modify database contents, or execute arbitrary OS commands on the server.",
    cause:
      "Web applications that build SQL queries by concatenating unsanitised user input are vulnerable. Even a single unparameterised query can expose the entire database. Techniques include UNION-based extraction, blind boolean/time-based inference, error-based enumeration, and stacked queries.",
    purpose:
      "To extract sensitive data (user credentials, personal records, financial data), bypass login mechanisms, modify or delete database records, or escalate to OS-level access (e.g., reading server files via LOAD_FILE, executing commands via xp_cmdshell on MSSQL servers).",
    indicators: ["SQL keywords in HTTP parameters (UNION, SELECT, OR 1=1, --)", "Anomalous database query execution times on specific endpoints", "Database error messages leaking schema information in responses", "High-volume probing requests targeting /login, /search, or /admin paths"],
  },
];

/* ── Attack Detail Card ──────────────────────────────────────────────────── */
function AttackCard({ attack }) {
  const { name, icon, color, description, cause, purpose, indicators } = attack;
  return (
    <div className={`card p-6 border-l-4 ${color.border} space-y-4`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color.badge}`}>ATTACK TYPE</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{name}</h3>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">What it is</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{description}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">How it works — Cause</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{cause}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">Attacker's goal — Purpose</p>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{purpose}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Detection Indicators</p>
        <ul className="space-y-1.5">
          {indicators.map((ind, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.dot}`} />
              {ind}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── Analytics Page ──────────────────────────────────────────────────────── */
export default function Analytics() {
  return (
    <div className="space-y-8">
      {/* Live stats + network map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ThreatStats />
        <NetworkMap />
      </div>

      {/* Attack reference section */}
      <div>
        <h2 className="page-title mb-1">Attack Reference</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Detailed breakdown of the 5 attack categories monitored by FusionGuardNet — including how each works, why attackers use it, and the network signals used to detect it.
        </p>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {ATTACKS.map(a => <AttackCard key={a.name} attack={a} />)}
        </div>
      </div>
    </div>
  );
}
