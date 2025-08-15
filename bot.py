import json
import re
from pathlib import Path

# ========================
# File paths
# ========================
INPUT = "data.txt"
OUTPUT = "data_hasil.txt"
RULES = "rules.json"

# ========================
# Regex untuk masing-masing blok
# ========================
sec1_re = re.compile(
    r"(?P<header>^\s*interface[^\n]*\n)(?P<body>(?:^(?!\s*interface).*\n?)*)",
    re.MULTILINE
)

sec2_re = re.compile(
    r"(?P<header>^\s*pon-onu-mng\s+(?P<intf>\S+).*\n)(?P<body>(?:^(?!\s*pon-onu-mng).*\n?)*)",
    re.MULTILINE
)

# ========================
# Load rules from JSON
# ========================
def load_rules():
    with open(RULES, encoding="utf-8") as f:
        return json.load(f)["rules"]

# ========================
# Rule functions
# ========================
def apply_replace_text(body, rule):
    if "from" in rule and "to" in rule:
        body = body.replace(rule["from"], rule["to"])
    return body

def apply_replace_multiple(body, rule):
    for rep in rule.get("replace_multiple", []):
        if "from" in rep and "to" in rep:
            body = body.replace(rep["from"], rep["to"])
    return body

def apply_insert_line(body, rule):
    lines = body.splitlines(True)
    new_lines = []
    target_pattern = rule.get("target", "")
    inserted = False
    last_idx = None

    for i, ln in enumerate(lines):
        new_lines.append(ln)
        if rule.get("position") == "before" and target_pattern in ln and not inserted:
            for l in rule.get("new_lines", []):
                new_lines.append(l + ("\n" if not l.endswith("\n") else ""))
            inserted = True
        elif rule.get("position") == "after" and target_pattern in ln and not inserted:
            for l in rule.get("new_lines", []):
                new_lines.append(l + ("\n" if not l.endswith("\n") else ""))
            inserted = True
        elif rule.get("position") == "after_last" and target_pattern in ln:
            last_idx = i

    if rule.get("position") == "after_last" and last_idx is not None:
        insert_idx = last_idx + 1
        new_lines[insert_idx:insert_idx] = [l + ("\n" if not l.endswith("\n") else "") for l in rule.get("new_lines", [])]

    return "".join(new_lines)

# ========================
# Process each block with applicable rules
# ========================
def process_block(header, body, interface_name, rules, block_name):
    for rule in rules:
        if not rule.get("active", False):
            continue
        if block_name not in rule.get("blocks", []):
            continue
        if rule.get("interface") != "all" and rule.get("interface") != interface_name:
            continue

        rule_type = rule.get("type", "")
        if rule_type == "replace_text":
            body = apply_replace_text(body, rule)
        elif rule_type == "replace_multiple":
            body = apply_replace_multiple(body, rule)
        elif rule_type == "insert_line":
            body = apply_insert_line(body, rule)
    return body

# ========================
# Main function
# ========================
def main():
    text = Path(INPUT).read_text(encoding="utf-8", errors="ignore")
    rules = load_rules()

    # ----- Sec.1 / interface -----
    out, last = [], 0
    for m in sec1_re.finditer(text):
        out.append(text[last:m.start()])
        header = m.group("header")
        body = m.group("body")
        intf_match = re.match(r"\s*interface\s+(\S+)", header)
        interface_name = intf_match.group(1) if intf_match else "all"
        body = process_block(header, body, interface_name, rules, "Sec.1")
        out.append(header)
        out.append(body)
        last = m.end()
    text_after_sec1 = "".join(out)

    # ----- Sec.2 / pon-onu-mng -----
    final_out, last = [], 0
    for m in sec2_re.finditer(text_after_sec1):
        final_out.append(text_after_sec1[last:m.start()])
        header = m.group("header")
        body = m.group("body")
        interface_name = m.group("intf")
        body = process_block(header, body, interface_name, rules, "Sec.2")
        final_out.append(header)
        final_out.append(body)
        last = m.end()
    final_out.append(text_after_sec1[last:])

    # Write output
    Path(OUTPUT).write_text("".join(final_out), encoding="utf-8")
    print(f"Selesai. Hasil: {OUTPUT}")

# ========================
# Run script
# ========================
if __name__ == "__main__":
    main()
