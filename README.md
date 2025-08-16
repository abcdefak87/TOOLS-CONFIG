# README (Short)

Script `update.py` edits `data.txt` based on rules in `rules.json` and writes result to `data_hasil.txt`.

## Supported rule types
- `replace_text` — replace a single string (`from`, `to`).
- `replace_multiple` — replace many pairs at once (`replace_multiple`: array of `{from, to}`).
- `insert_line` — insert line(s) around a target (`target`, `position`: `before`/`after`/`after_last`, `new_lines`).

## Files
- `update.py` — main script
- `data.txt` — input
- `data_hasil.txt` — output
- `rules.json` — rules (must be valid JSON)

## Quick `rules.json` examples

**replace_text**
```json
{
  "name":"replace_one_text",
  "active":true,
  "blocks":["Sec.1"],
  "interface":"all",
  "type":"replace_text",
  "from":"OLD","to":"NEW"
}
