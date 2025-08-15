import re
import json
from pathlib import Path

# =====================
# Config file
# =====================
INPUT = "data.txt"       # file input
OUTPUT = "data_hasil.txt" # file output
RULES_FILE = "rules.json" # file rules JSON

# =====================
# Regex blok
# =====================
interface_re = re.compile(
    r"(?P<header>^\s*interface\s+\S+\n)"
    r"(?P<body>(?:^(?!\s*interface).*\n?)*)",
    re.MULTILINE
)

ponmng_re = re.compile(
    r"(?P<header>^\s*pon-onu-mng\s+\S+\n)"
    r"(?P<body>(?:^(?!\s*pon-onu-mng).*\n?)*)",
    re.MULTILINE
)

# =====================
# Utility functions
# =====================

def sisip_baris_pintar(body: str, target: str, baris_baru: list, lokasi: str) -> str:
    lines = body.splitlines(True)
    new_lines = []
    target_idxs = [i for i, ln in enumerate(lines) if target in ln]

    if not target_idxs:
        return body  # target tidak ditemukan → skip

    # filter baris baru yang belum ada
    baris_baru_filtered = [b for b in baris_baru if not any(b.strip() in ln.strip() for ln in lines)]
    if not baris_baru_filtered:
        return body  # semua baris sudah ada → skip

    if lokasi == "sebelum":
        for i, ln in enumerate(lines):
            if i == target_idxs[0]:
                for b in baris_baru_filtered:
                    new_lines.append(b + "\n")
            new_lines.append(ln)
    elif lokasi == "setelah":
        for i, ln in enumerate(lines):
            new_lines.append(ln)
            if i == target_idxs[0]:
                for b in baris_baru_filtered:
                    new_lines.append(b + "\n")
    elif lokasi == "setelah_terakhir":
        last_idx = target_idxs[-1]
        for i, ln in enumerate(lines):
            new_lines.append(ln)
            if i == last_idx:
                for b in baris_baru_filtered:
                    new_lines.append(b + "\n")
    else:
        return body

    return "".join(new_lines)

def ganti_text_pintar(body: str, rule: dict) -> str:
    """
    Ganti teks di body sesuai rule JSON
    """
    if rule.get("ganti_beberapa"):
        for g in rule["ganti_beberapa"]:
            pattern = g["dari"]
            repl = g["menjadi"]
            body = re.sub(pattern, repl, body)
    else:
        dari = rule.get("dari")
        menjadi = rule.get("menjadi")
        if rule.get("regex"):
            body = re.sub(dari, menjadi, body)
        else:
            body = body.replace(dari, menjadi)
    return body

def hapus_baris_pintar(body: str, target: str) -> str:
    lines = body.splitlines(True)
    new_lines = [ln for ln in lines if target not in ln]
    return "".join(new_lines)

# =====================
# Main processing
# =====================

def process_rules(body: str, rules: list, sec: str, interface_name: str) -> str:
    for rule in rules:
        if not rule.get("aktif"):
            continue
        if sec not in rule.get("blok", []):
            continue
        target_interface = rule.get("interface", "semua")
        if target_interface != "semua" and target_interface != interface_name:
            continue

        tipe = rule.get("tipe")
        if tipe == "sisip_baris":
            body = sisip_baris_pintar(body, rule["target"], rule["baris_baru"], rule["lokasi"])
        elif tipe == "ganti_text" or tipe == "ganti_beberapa":
            body = ganti_text_pintar(body, rule)
        elif tipe == "hapus_baris":
            body = hapus_baris_pintar(body, rule["target"])
    return body

def main():
    text = Path(INPUT).read_text(encoding="utf-8", errors="ignore")
    rules = json.loads(Path(RULES_FILE).read_text(encoding="utf-8"))

    # proses blok interface (Sec.1)
    out, last = [], 0
    for m in interface_re.finditer(text):
        out.append(text[last:m.start()])
        header = m.group("header")
        body = m.group("body")
        intf_match = re.match(r"\s*interface\s+(\S+)", header)
        interface_name = intf_match.group(1) if intf_match else "unknown"
        body = process_rules(body, rules["rules"], "Sec. 1", interface_name)
        out.append(header)
        out.append(body)
        last = m.end()
    text_after_interface = "".join(out)

    # proses blok pon-onu-mng (Sec.2)
    final_text, last = [], 0
    for m in ponmng_re.finditer(text_after_interface):
        final_text.append(text_after_interface[last:m.start()])
        header = m.group("header")
        body = m.group("body")
        intf_match = re.match(r"\s*pon-onu-mng\s+(\S+)", header)
        interface_name = intf_match.group(1) if intf_match else "unknown"
        body = process_rules(body, rules["rules"], "Sec. 2", interface_name)
        final_text.append(header)
        final_text.append(body)
        last = m.end()
    final_text.append(text_after_interface[last:])

    Path(OUTPUT).write_text("".join(final_text), encoding="utf-8")
    print(f"Selesai. Hasil disimpan di {OUTPUT}")

if __name__ == "__main__":
    main()
