/**
 * FusionGuardNet – Report Download
 * Exports the current alert list as a styled PDF or an Excel workbook.
 * Uses:  jspdf + jspdf-autotable  →  PDF
 *        xlsx (SheetJS)           →  Excel
 */
import { useState } from "react";
import { FileText, FileSpreadsheet, Download, ChevronDown } from "lucide-react";
import { useAlertsContext } from "@/contexts/AlertsContext";

/* ── helpers ──────────────────────────────────────────────────────────────── */
function formatTs(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}

function severityColor(sev) {
  return { critical: [239,68,68], high: [249,115,22], medium: [234,179,8], low: [59,130,246] }[sev] || [107,114,128];
}

/* ── PDF export ──────────────────────────────────────────────────────────── */
async function downloadPDF(alerts) {
  const { jsPDF } = await import("jspdf");
  const autoTable  = (await import("jspdf-autotable")).default;

  const doc  = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const now  = new Date().toLocaleString();
  const W    = doc.internal.pageSize.getWidth();

  /* ── header bar ── */
  doc.setFillColor(2, 20, 10);
  doc.rect(0, 0, W, 22, "F");

  doc.setTextColor(0, 255, 136);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FusionGuardNet", 14, 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 204, 100);
  doc.text("Advanced Multimodal Intrusion Detection System", 14, 16);

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(8);
  doc.text(`Generated: ${now}`, W - 14, 10, { align: "right" });
  doc.text(`Total alerts: ${alerts.length}`, W - 14, 16, { align: "right" });

  /* ── summary boxes ── */
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const typeCounts = {};
  alerts.forEach(a => {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
    typeCounts[a.attack_type] = (typeCounts[a.attack_type] || 0) + 1;
  });

  const sevLabels = [
    { label: "Critical", key: "critical", col: [239,68,68] },
    { label: "High",     key: "high",     col: [249,115,22] },
    { label: "Medium",   key: "medium",   col: [234,179,8]  },
    { label: "Low",      key: "low",      col: [59,130,246] },
  ];

  let bx = 14;
  sevLabels.forEach(({ label, key, col }) => {
    doc.setFillColor(...col);
    doc.roundedRect(bx, 26, 46, 14, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), bx + 4, 31);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(counts[key] || 0), bx + 4, 38);
    bx += 50;
  });

  /* ── attack type summary ── */
  let tx = bx + 8;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ATTACK BREAKDOWN", tx, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let ty = 35;
  Object.entries(typeCounts).forEach(([type, cnt]) => {
    doc.setTextColor(40, 40, 40);
    doc.text(`${type}:`, tx, ty);
    doc.setTextColor(0, 100, 200);
    doc.text(String(cnt), tx + 38, ty);
    ty += 5;
  });

  /* ── table ── */
  const rows = alerts.map(a => [
    formatTs(a.timestamp),
    a.attack_type || "—",
    a.severity?.toUpperCase() || "—",
    `${((a.confidence || 0) * 100).toFixed(0)}%`,
    a.src_ip || "—",
    a.dst_ip || "—",
    a.details || "—",
    a.status || "—",
  ]);

  autoTable(doc, {
    startY: 46,
    head: [["Timestamp", "Attack Type", "Severity", "Confidence", "Source IP", "Dest IP", "Details", "Status"]],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [2, 20, 10], textColor: [0, 255, 136], fontStyle: "bold", fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 18 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
      6: { cellWidth: "auto" },
      7: { cellWidth: 22 },
    },
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 2) {
        const sev = (data.cell.raw || "").toLowerCase();
        const [r, g, b] = severityColor(sev);
        data.cell.styles.textColor = [r, g, b];
        data.cell.styles.fontStyle = "bold";
      }
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  /* ── footer on every page ── */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `FusionGuardNet Security Report  •  Page ${i} of ${pageCount}  •  CONFIDENTIAL`,
      W / 2, doc.internal.pageSize.getHeight() - 5,
      { align: "center" }
    );
  }

  doc.save(`FusionGuardNet_Report_${Date.now()}.pdf`);
}

/* ── Excel export ─────────────────────────────────────────────────────────── */
async function downloadExcel(alerts) {
  const XLSX = await import("xlsx");

  /* Analysis data */
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  const typeCounts = {};
  const criticalAlerts = [];
  const highAlerts = [];
  let totalConfidence = 0;
  const sourceIPs = new Set();
  const destIPs = new Set();

  alerts.forEach(a => {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
    typeCounts[a.attack_type] = (typeCounts[a.attack_type] || 0) + 1;
    totalConfidence += (a.confidence || 0);
    if (a.src_ip) sourceIPs.add(a.src_ip);
    if (a.dst_ip) destIPs.add(a.dst_ip);
    if (a.severity === "critical") criticalAlerts.push(a);
    if (a.severity === "high") highAlerts.push(a);
  });

  const avgConfidence = alerts.length > 0 ? ((totalConfidence / alerts.length) * 100).toFixed(1) : 0;
  const riskScore = Math.min(100, (counts.critical * 25 + counts.high * 15 + counts.medium * 5)).toFixed(0);

  /* Enhanced Summary Sheet */
  const summaryData = [
    ["FusionGuardNet – Advanced Multimodal IDS Security Report"],
    [],
    ["REPORT OVERVIEW"],
    ["Generated Date", new Date().toLocaleString()],
    ["Report Period", "24-Hour Window"],
    ["Total Alerts Detected", alerts.length],
    [],
    ["RISK METRICS"],
    ["Overall Risk Score", `${riskScore}/100`],
    ["Average Confidence Level", `${avgConfidence}%`],
    ["Unique Source IPs", sourceIPs.size],
    ["Unique Destination IPs", destIPs.size],
    [],
    ["SEVERITY BREAKDOWN"],
    ["Severity Level", "Count", "Percentage"],
    ["🔴 CRITICAL", counts.critical || 0, alerts.length > 0 ? ((counts.critical / alerts.length) * 100).toFixed(1) + "%" : "0%"],
    ["🟠 HIGH", counts.high || 0, alerts.length > 0 ? ((counts.high / alerts.length) * 100).toFixed(1) + "%" : "0%"],
    ["🟡 MEDIUM", counts.medium || 0, alerts.length > 0 ? ((counts.medium / alerts.length) * 100).toFixed(1) + "%" : "0%"],
    ["🟢 LOW", counts.low || 0, alerts.length > 0 ? ((counts.low / alerts.length) * 100).toFixed(1) + "%" : "0%"],
    [],
    ["ATTACK TYPE DISTRIBUTION"],
    ["Attack Type", "Count", "Risk Level"],
    ...Object.entries(typeCounts).map(([type, cnt]) => {
      const risk = type.toLowerCase().includes("critical") || type.toLowerCase().includes("ddos") ? "CRITICAL" :
                  type.toLowerCase().includes("brute") ? "HIGH" : "MEDIUM";
      return [type, cnt, risk];
    }),
  ];

  /* Detailed Alerts Sheet */
  const detailedAlertRows = [
    ["ID", "Timestamp", "Attack Type", "Severity", "Confidence (%)", "Source IP", "Dest IP", "Source Port", "Dest Port", "Protocol", "Details", "Method", "Attack Vector", "Status", "Recommended Action"],
    ...alerts.map((a, idx) => [
      idx + 1,
      formatTs(a.timestamp),
      a.attack_type || "—",
      (a.severity || "—").toUpperCase(),
      Number(((a.confidence || 0) * 100).toFixed(1)),
      a.src_ip || "—",
      a.dst_ip || "—",
      a.src_port || "—",
      a.dst_port || "—",
      a.protocol || "—",
      a.details || "—",
      a.method || "—",
      a.attack_vector || "—",
      a.status || "pending",
      getRecommendation(a),
    ]),
  ];

  /* Critical Alerts Sheet */
  const criticalRows = [
    ["CRITICAL SEVERITY ALERTS – IMMEDIATE ACTION REQUIRED"],
    ["Total Critical Alerts", criticalAlerts.length],
    [],
    ["Timestamp", "Attack Type", "Source IP", "Destination IP", "Details", "Confidence (%)", "Status", "Action"],
    ...criticalAlerts.map(a => [
      formatTs(a.timestamp),
      a.attack_type || "—",
      a.src_ip || "—",
      a.dst_ip || "—",
      a.details || "—",
      Number(((a.confidence || 0) * 100).toFixed(1)),
      a.status || "pending",
      "ISOLATE & INVESTIGATE",
    ]),
  ];

  /* Attack Type Deep Dive */
  const attackTypeData = [
    ["ATTACK TYPE ANALYSIS"],
    [],
    ...Object.entries(typeCounts).flatMap(([type, cnt]) => {
      const typeAlerts = alerts.filter(a => a.attack_type === type);
      const avgConf = typeAlerts.length > 0 
        ? ((typeAlerts.reduce((s, a) => s + (a.confidence || 0), 0) / typeAlerts.length) * 100).toFixed(1)
        : 0;
      const sourceIpSet = new Set(typeAlerts.map(a => a.src_ip).filter(Boolean));
      return [
        [type.toUpperCase()],
        ["Total Occurrences", cnt],
        ["Avg Confidence", `${avgConf}%`],
        ["Unique Attackers", sourceIpSet.size],
        ["Severity Distribution", 
          `Critical: ${typeAlerts.filter(a => a.severity === "critical").length}, ` +
          `High: ${typeAlerts.filter(a => a.severity === "high").length}, ` +
          `Medium: ${typeAlerts.filter(a => a.severity === "medium").length}, ` +
          `Low: ${typeAlerts.filter(a => a.severity === "low").length}`
        ],
        [],
      ];
    }),
  ];

  /* Recommendations Sheet */
  const recommendationsData = [
    ["SECURITY RECOMMENDATIONS"],
    [],
    ["Based on detected threats:"],
    [],
  ];

  if (counts.critical > 0) {
    recommendationsData.push(
      ["IMMEDIATE (Critical Priority)"],
      ["1. Isolate affected systems from network"],
      ["2. Block source IPs at firewall level"],
      ["3. Review access logs and audit trails"],
      ["4. Activate incident response procedures"],
      []
    );
  }

  if (counts.high > 0) {
    recommendationsData.push(
      ["URGENT (High Priority)"],
      ["1. Investigate and block suspicious traffic"],
      ["2. Strengthen authentication controls"],
      ["3. Monitor affected services closely"],
      ["4. Update security policies"],
      []
    );
  }

  recommendationsData.push(
    ["GENERAL (All Environments)"],
    ["1. Deploy advanced ML-based threat detection"],
    ["2. Implement network segmentation"],
    ["3. Enable comprehensive logging and monitoring"],
    ["4. Conduct regular security audits"],
    ["5. Update IDS/IPS signatures regularly"],
    ["6. Train staff on security best practices"],
  );

  const wb = XLSX.utils.book_new();

  // Summary
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "📊 Summary");

  // Detailed Alerts
  const wsDetailed = XLSX.utils.aoa_to_sheet(detailedAlertRows);
  wsDetailed["!cols"] = [
    { wch: 6 }, { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 14 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetailed, "🔍 All Alerts");

  // Critical Alerts
  if (criticalAlerts.length > 0) {
    const wsCritical = XLSX.utils.aoa_to_sheet(criticalRows);
    wsCritical["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsCritical, "🔴 CRITICAL");
  }

  // Attack Type Analysis
  const wsAttackType = XLSX.utils.aoa_to_sheet(attackTypeData);
  wsAttackType["!cols"] = [{ wch: 40 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsAttackType, "🎯 Attack Analysis");

  // Recommendations
  const wsRec = XLSX.utils.aoa_to_sheet(recommendationsData);
  wsRec["!cols"] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsRec, "💡 Recommendations");

  XLSX.writeFile(wb, `FusionGuardNet_Report_${Date.now()}.xlsx`);
}

/* ── Helper: Get recommendation based on attack ──────────────────────────── */
function getRecommendation(alert) {
  const type = (alert.attack_type || "").toLowerCase();
  const severity = (alert.severity || "").toLowerCase();

  if (severity === "critical") return "BLOCK & INVESTIGATE";
  if (type.includes("ddos")) return "ACTIVATE DDoS MITIGATION";
  if (type.includes("brute")) return "ENABLE MFA & RATE LIMITING";
  if (type.includes("malware")) return "ISOLATE & SCAN";
  if (type.includes("injection")) return "PATCH & VALIDATE INPUT";
  if (type.includes("scan")) return "BLOCK SOURCE IP";
  return "MONITOR CLOSELY";
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function ReportDownload({ className = "" }) {
  const { alerts } = useAlertsContext();
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null); // "pdf" | "excel" | null

  const handle = async (type) => {
    if (!alerts.length) return;
    setLoading(type);
    setOpen(false);
    try {
      if (type === "pdf")   await downloadPDF(alerts);
      if (type === "excel") await downloadExcel(alerts);
    } catch (e) {
      console.error("Report export failed:", e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!loading || alerts.length === 0}
        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Download size={13} className="animate-bounce" />
        ) : (
          <Download size={13} />
        )}
        {loading ? `Exporting ${loading.toUpperCase()}…` : "Download Report"}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 mt-1 z-50 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Export {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              onClick={() => handle("pdf")}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <FileText size={16} className="text-red-500 shrink-0" />
              <div className="text-left">
                <p className="font-medium leading-none">PDF Report</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Styled, paginated document</p>
              </div>
            </button>

            <button
              onClick={() => handle("excel")}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors border-t border-gray-100 dark:border-gray-700"
            >
              <FileSpreadsheet size={16} className="text-green-500 shrink-0" />
              <div className="text-left">
                <p className="font-medium leading-none">Excel Workbook</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Summary + full alert sheet</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
