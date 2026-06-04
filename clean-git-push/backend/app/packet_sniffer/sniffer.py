"""
FusionGuardNet – Packet Sniffer
Runs as an asyncio background task.
In SIMULATION_MODE=True  → generates synthetic packets at a configurable rate.
In SIMULATION_MODE=False → uses Scapy for live capture (requires root/admin).
"""

import asyncio
import logging
import random
import time
import uuid
from collections import defaultdict, deque
from typing import Callable, Deque, Dict, List, Optional

from app.core.config import settings
from app.packet_sniffer.packet_processor import process_scapy_packet, simulate_packet
from app.ml.detection import (
    ddos_detector,
    port_scan_detector,
    brute_force_detector,
    malware_detector,
    sql_injection_detector,
)
from app.ml.fusion_layer import (
    fuse, NetworkSignal, LogSignal, BehaviourSignal, ThreatFeedSignal
)

logger = logging.getLogger(__name__)

# ── Shared state (in-memory ring buffers) ────────────────────────────────────
RECENT_PACKETS:     Deque[Dict] = deque(maxlen=200)
RECENT_ALERTS:      Deque[Dict] = deque(maxlen=settings.ALERT_HISTORY_LIMIT)
ALERT_CALLBACKS:    List[Callable] = []          # registered WebSocket broadcasters

# Per-source flow accumulators (reset every FLOW_WINDOW_SEC)
FLOW_WINDOW_SEC  = 5.0
_flow_buf:  Dict[str, List[Dict]] = defaultdict(list)
_port_map:  Dict[str, set]        = defaultdict(set)
_last_reset = time.time()


# ── Alert factory ────────────────────────────────────────────────────────────

def _make_alert(detection: Dict, src_ip: str, dst_ip: str = "10.0.0.1") -> Dict:
    return {
        "id":          str(uuid.uuid4()),
        "timestamp":   time.time(),
        "attack_type": detection["attack_type"],
        "src_ip":      src_ip,
        "dst_ip":      dst_ip,
        "confidence":  detection["confidence"],
        "method":      detection["method"],
        "details":     detection.get("details", ""),
        "severity":    _severity(detection["confidence"]),
        "status":      "active",
    }


def _severity(confidence: float) -> str:
    if confidence >= 0.90: return "critical"
    if confidence >= 0.75: return "high"
    if confidence >= 0.60: return "medium"
    return "low"


# ── Broadcast helpers ────────────────────────────────────────────────────────

async def _broadcast(alert: Dict):
    RECENT_ALERTS.appendleft(alert)
    for cb in list(ALERT_CALLBACKS):
        try:
            await cb(alert)
        except Exception as exc:
            logger.debug("Broadcast callback error: %s", exc)


def register_alert_callback(cb: Callable):
    ALERT_CALLBACKS.append(cb)


def unregister_alert_callback(cb: Callable):
    if cb in ALERT_CALLBACKS:
        ALERT_CALLBACKS.remove(cb)


# ── Flow processing ──────────────────────────────────────────────────────────

async def _process_packet(pkt: Dict):
    global _last_reset

    RECENT_PACKETS.appendleft(pkt)
    src_ip   = pkt.get("src_ip", "0.0.0.0")
    dst_ip   = pkt.get("dst_ip", "10.0.0.1")
    dst_port = int(pkt.get("dst_port", 0))

    _flow_buf[src_ip].append(pkt)
    _port_map[src_ip].add(dst_port)

    # ── Per-packet: Malware + SQLi ────────────────────────────────────────
    mal = malware_detector.detect(pkt)
    if mal["attack_type"]:
        await _broadcast(_make_alert(mal, src_ip, dst_ip))

    sqli_payload = pkt.get("payload", "")
    if sqli_payload:
        sqli = sql_injection_detector.detect({"payload": sqli_payload, "path": ""})
        if sqli["attack_type"]:
            await _broadcast(_make_alert(sqli, src_ip, dst_ip))

    # ── Port-scan check ───────────────────────────────────────────────────
    ps = port_scan_detector.detect(
        list(RECENT_PACKETS)[:10],
        {src_ip: _port_map[src_ip]},
    )
    if ps["attack_type"]:
        await _broadcast(_make_alert(ps, src_ip, dst_ip))

    # ── Brute-force (track auth on port 22/23/21/3389) ───────────────────
    if dst_port in {22, 23, 21, 3389, 25}:
        success = not pkt.get("flag_rst", False)
        brute_force_detector.record_attempt(src_ip, success, pkt.get("timestamp"))
        bf = brute_force_detector.detect(src_ip, list(RECENT_PACKETS)[:10])
        if bf["attack_type"]:
            await _broadcast(_make_alert(bf, src_ip, dst_ip))

    # ── Flow-window DDoS check ───────────────────────────────────────────
    now = time.time()
    if now - _last_reset >= FLOW_WINDOW_SEC:
        for ip, pkts in _flow_buf.items():
            if not pkts:
                continue
            elapsed = max(now - _last_reset, 0.001)
            total_bytes = sum(p.get("payload_len", 64) for p in pkts)
            syn_count   = sum(1 for p in pkts if p.get("flag_syn"))
            flow = {
                "pkt_count":        len(pkts),
                "byte_count":       total_bytes,
                "pkt_rate":         len(pkts) / elapsed,
                "byte_rate":        total_bytes / elapsed,
                "avg_pkt_len":      total_bytes / len(pkts),
                "std_pkt_len":      20.0,
                "unique_src_ips":   len({p.get("src_ip") for p in pkts}),
                "unique_dst_ports": len({p.get("dst_port") for p in pkts}),
                "syn_ratio":        syn_count / len(pkts),
                "icmp_ratio":       0.0,
            }
            ddos = ddos_detector.detect(flow)
            if ddos["attack_type"]:
                await _broadcast(_make_alert(ddos, ip, dst_ip))

        _flow_buf.clear()
        _port_map.clear()
        _last_reset = now


# ── 5 canonical attack types ─────────────────────────────────────────────────

REALISTIC_ATTACKS = [
    # (attack_type, canonical_name, weight)
    ("ddos",        "DDoS",          30),
    ("port_scan",   "Port Scan",     20),
    ("brute_force", "Brute Force",   15),
    ("malware",     "Malware",       20),
    ("sqli",        "SQL Injection", 15),
]

# Realistic source IP ranges (internal + external threat actors)
_THREAT_SUBNETS = [
    "192.168.{}.{}", "10.{}.{}.{}", "172.16.{}.{}",
    "45.{}.{}.{}", "185.{}.{}.{}", "91.{}.{}.{}",
    "194.{}.{}.{}", "103.{}.{}.{}", "5.{}.{}.{}",
]

def _rand_ip(rng: random.Random) -> str:
    tmpl = rng.choice(_THREAT_SUBNETS)
    octets = [rng.randint(1, 254) for _ in range(tmpl.count("{}"))]
    return tmpl.format(*octets)

def _weighted_attack(rng: random.Random):
    pool = []
    for atype, name, weight in REALISTIC_ATTACKS:
        pool.extend([(atype, name)] * weight)
    return rng.choice(pool)


async def _emit_realistic_alert(rng: random.Random):
    """Build and broadcast one realistic-looking attack alert directly."""
    attack_key, attack_name = _weighted_attack(rng)
    src_ip = _rand_ip(rng)
    dst_ip = rng.choice(["10.0.0.1", "10.0.0.2", "172.16.0.1", "192.168.1.1"])
    confidence = rng.uniform(0.72, 0.99)

    if attack_key == "ddos":
        pps = rng.randint(5000, 980000)
        gbps = round(rng.uniform(0.4, 48.0), 1)
        details = f"{pps:,} pkt/s · {gbps} Gbps · syn_ratio={rng.uniform(0.85,1.0):.2f}"
    elif attack_key == "port_scan":
        ports = rng.randint(120, 65000)
        details = f"{ports:,} ports scanned · {rng.randint(3,30)} ms avg RTT"
    elif attack_key == "brute_force":
        attempts = rng.randint(80, 4800)
        details = f"{attempts:,} attempts · {rng.randint(1,12)} unique users targeted"
    elif attack_key == "malware":
        c2 = f"{rng.randint(1,254)}.{rng.randint(1,254)}.{rng.randint(1,254)}.{rng.randint(1,254)}"
        details = f"C2={c2}:{rng.randint(1024,65535)} · {rng.randint(1,16)} infected hosts"
    else:  # sqli
        patterns = rng.randint(2, 7)
        details = f"matched {patterns} pattern(s) · target: {rng.choice(['/login','/api/users','/search','/admin','/products'])}"

    alert = {
        "id":          str(uuid.uuid4()),
        "timestamp":   time.time(),
        "attack_type": attack_name,
        "src_ip":      src_ip,
        "dst_ip":      dst_ip,
        "confidence":  round(confidence, 2),
        "method":      "fusion",
        "details":     details,
        "severity":    _severity(confidence),
        "status":      "active",
    }
    await _broadcast(alert)
    logger.info("Alert: [%s] %s %s → %s (%.0f%%)", alert["severity"].upper(),
                attack_name, src_ip, dst_ip, confidence * 100)


# ── Main sniffer loop ────────────────────────────────────────────────────────

ATTACK_WAVE_INTERVAL = 600.0   # 10 minutes between attack waves

async def _emit_attack_wave(rng: random.Random):
    """
    Simulate a realistic multi-stage attack campaign.
    Emits 5–8 alerts in rapid succession (0.5–2 s apart) to recreate
    the pattern of a real coordinated attack wave.
    """
    wave_size = rng.randint(5, 8)
    logger.info("⚡ Attack wave starting – %d alerts incoming", wave_size)
    for i in range(wave_size):
        await _emit_realistic_alert(rng)
        if i < wave_size - 1:
            await asyncio.sleep(rng.uniform(0.5, 2.0))
    logger.info("⚡ Attack wave complete (%d alerts)", wave_size)


async def run_sniffer():
    """
    Background asyncio task – SIMULATION mode.
    Fires an initial burst on startup so the feed is never empty,
    then emits a realistic attack wave every 10 minutes.
    """
    if not settings.SNIFFER_SIMULATION_MODE:
        await _run_live_sniffer()
        return

    logger.info("Packet sniffer started in SIMULATION mode (wave every %ds)", int(ATTACK_WAVE_INTERVAL))
    rng = random.Random()

    # Initial burst so the feed isn't empty on first load
    await _emit_attack_wave(rng)

    while True:
        # Wait 10 minutes, then fire the next wave
        await asyncio.sleep(ATTACK_WAVE_INTERVAL)
        await _emit_attack_wave(rng)


async def _run_live_sniffer():
    """Live packet capture using Scapy (requires elevated privileges)."""
    try:
        from scapy.all import sniff, conf
        conf.verb = 0
        logger.info("Live sniffer on interface: %s", settings.SNIFFER_INTERFACE)

        def _callback(pkt):
            processed = process_scapy_packet(pkt)
            if processed:
                asyncio.create_task(_process_packet(processed))

        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: sniff(iface=settings.SNIFFER_INTERFACE, prn=_callback, store=False),
        )
    except ImportError:
        logger.warning("Scapy not available – falling back to simulation mode")
        await run_sniffer()
    except Exception as exc:
        logger.error("Live sniffer error: %s – falling back to simulation", exc)
        await run_sniffer()
