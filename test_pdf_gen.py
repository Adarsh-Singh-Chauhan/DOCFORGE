import io
import re
from pypdf import PdfReader

def escape_pdf_text(text: str) -> str:
    cleaned = "".join(ch if 32 <= ord(ch) <= 126 else " " for ch in text)
    return cleaned.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

def generate_vector_pdf(title: str, markdown: str) -> bytes:
    raw_lines = markdown.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    pages_ops: list[list[str]] = [[]]
    cur_page_idx = 0
    cur_y = 770.0
    margin_x = 48.0
    page_width = 595.28
    page_height = 841.89
    max_content_width = page_width - (margin_x * 2)
    bottom_limit = 65.0

    def new_page():
        nonlocal cur_page_idx, cur_y
        pages_ops.append([])
        cur_page_idx += 1
        cur_y = 770.0

    def check_page_space(needed_pt: float):
        nonlocal cur_y
        if cur_y - needed_pt < bottom_limit:
            new_page()

    def wrap_text(text: str, max_chars: int) -> list[str]:
        words = text.split()
        if not words:
            return []
        lines = []
        cur_line = ""
        for w in words:
            if len((cur_line + " " + w).strip()) <= max_chars:
                cur_line = (cur_line + " " + w).strip()
            else:
                if cur_line:
                    lines.append(cur_line)
                cur_line = w
        if cur_line:
            lines.append(cur_line)
        return lines

    table_buffer: list[list[str]] = []
    code_buffer: list[str] = []
    in_code_block = False

    def flush_table():
        nonlocal cur_y
        if not table_buffer:
            return
        num_cols = max(len(row) for row in table_buffer)
        if num_cols == 0:
            table_buffer.clear()
            return
        col_width = max_content_width / num_cols
        row_height = 18.0

        for r_idx, row in enumerate(table_buffer):
            check_page_space(row_height + 4)
            y_box = cur_y - row_height + 4
            # Row background
            if r_idx == 0:
                pages_ops[cur_page_idx].append(f"0.92 0.94 0.98 rg {margin_x:.2f} {y_box:.2f} {max_content_width:.2f} {row_height:.2f} re f")
            elif r_idx % 2 == 1:
                pages_ops[cur_page_idx].append(f"0.97 0.98 0.99 rg {margin_x:.2f} {y_box:.2f} {max_content_width:.2f} {row_height:.2f} re f")
            
            # Row borders
            pages_ops[cur_page_idx].append(f"0.80 0.83 0.88 RG 0.5 w {margin_x:.2f} {y_box:.2f} {max_content_width:.2f} {row_height:.2f} re S")

            font = "/F2 8.5" if r_idx == 0 else "/F1 8.5"
            text_color = "0.08 0.12 0.22" if r_idx == 0 else "0.15 0.20 0.30"
            for c_idx in range(num_cols):
                cell_text = row[c_idx] if c_idx < len(row) else ""
                cell_x = margin_x + (c_idx * col_width) + 4
                esc = escape_pdf_text(cell_text)[: int(col_width / 5.5)]
                pages_ops[cur_page_idx].append(f"BT {font} Tf {text_color} rg {cell_x:.2f} {cur_y - 8:.2f} Td ({esc}) Tj ET")
            cur_y -= row_height
        cur_y -= 8
        table_buffer.clear()

    def flush_code():
        nonlocal cur_y
        if not code_buffer:
            return
        block_height = len(code_buffer) * 13.0 + 12.0
        check_page_space(min(block_height, 250.0))
        y_box = cur_y - block_height + 10
        pages_ops[cur_page_idx].append(f"0.94 0.95 0.97 rg {margin_x:.2f} {y_box:.2f} {max_content_width:.2f} {block_height:.2f} re f")
        pages_ops[cur_page_idx].append(f"0.82 0.84 0.88 RG 0.5 w {margin_x:.2f} {y_box:.2f} {max_content_width:.2f} {block_height:.2f} re S")
        cur_y -= 8
        for cl in code_buffer:
            check_page_space(14)
            esc = escape_pdf_text(cl)[:95]
            pages_ops[cur_page_idx].append(f"BT /F4 8.5 Tf 0.15 0.20 0.30 rg {margin_x + 8:.2f} {cur_y:.2f} Td ({esc}) Tj ET")
            cur_y -= 13
        cur_y -= 10
        code_buffer.clear()

    for raw_line in raw_lines:
        line = raw_line.strip()
        if line.startswith("```"):
            if in_code_block:
                flush_code()
                in_code_block = False
            else:
                in_code_block = True
            continue

        if in_code_block:
            code_buffer.append(raw_line)
            continue

        if line.startswith("|") and line.endswith("|"):
            if "---" in line:
                continue
            cells = [c.strip() for c in line.split("|")[1:-1]]
            table_buffer.append(cells)
            continue
        else:
            flush_table()

        if line.startswith("<!-- Page") or line == "---":
            if pages_ops[cur_page_idx]:
                new_page()
            continue

        if not line:
            cur_y -= 6
            continue

        # Heading 1
        if line.startswith("# "):
            check_page_space(35)
            cur_y -= 12
            text = escape_pdf_text(line[2:].strip())
            pages_ops[cur_page_idx].append(f"BT /F2 16 Tf 0.06 0.09 0.16 rg {margin_x:.2f} {cur_y:.2f} Td ({text}) Tj ET")
            cur_y -= 20
            pages_ops[cur_page_idx].append(f"0.88 0.31 0.09 RG 1.5 w {margin_x:.2f} {cur_y + 8:.2f} m {margin_x + 60:.2f} {cur_y + 8:.2f} l S")
            cur_y -= 6
            continue

        # Heading 2
        if line.startswith("## "):
            check_page_space(28)
            cur_y -= 10
            text = escape_pdf_text(line[3:].strip())
            pages_ops[cur_page_idx].append(f"BT /F2 12.5 Tf 0.12 0.16 0.24 rg {margin_x:.2f} {cur_y:.2f} Td ({text}) Tj ET")
            cur_y -= 16
            continue

        # Heading 3
        if line.startswith("### "):
            check_page_space(22)
            cur_y -= 8
            text = escape_pdf_text(line[4:].strip())
            pages_ops[cur_page_idx].append(f"BT /F2 10.5 Tf 0.20 0.25 0.35 rg {margin_x:.2f} {cur_y:.2f} Td ({text}) Tj ET")
            cur_y -= 14
            continue

        # Blockquote
        if line.startswith(">"):
            q_text = line.lstrip("> ").strip()
            wrapped = wrap_text(q_text, 76)
            q_height = len(wrapped) * 13.0 + 6.0
            check_page_space(q_height)
            pages_ops[cur_page_idx].append(f"0.88 0.31 0.09 rg {margin_x:.2f} {cur_y - q_height + 11:.2f} 3 {q_height:.2f} re f")
            for wl in wrapped:
                pages_ops[cur_page_idx].append(f"BT /F3 9.5 Tf 0.45 0.25 0.10 rg {margin_x + 10:.2f} {cur_y:.2f} Td ({escape_pdf_text(wl)}) Tj ET")
                cur_y -= 13
            cur_y -= 6
            continue

        # Bullet lists
        if re.match(r"^[\*\-]\s+", line):
            b_text = re.sub(r"^[\*\-]\s+", "", line)
            wrapped = wrap_text(b_text, 78)
            check_page_space(len(wrapped) * 13.0)
            for i, wl in enumerate(wrapped):
                prefix = "* " if i == 0 else "  "
                pages_ops[cur_page_idx].append(f"BT /F1 9.5 Tf 0.15 0.18 0.25 rg {margin_x + 10:.2f} {cur_y:.2f} Td ({escape_pdf_text(prefix + wl)}) Tj ET")
                cur_y -= 13
            continue

        # Regular paragraph
        wrapped = wrap_text(line, 82)
        check_page_space(len(wrapped) * 13.0 + 4.0)
        for wl in wrapped:
            pages_ops[cur_page_idx].append(f"BT /F1 9.5 Tf 0.15 0.18 0.25 rg {margin_x:.2f} {cur_y:.2f} Td ({escape_pdf_text(wl)}) Tj ET")
            cur_y -= 13
        cur_y -= 4

    flush_table()
    flush_code()

    total_pages = len(pages_ops)
    clean_title = escape_pdf_text(f"DOCFORGE STUDIO · {title}")[:60]
    for p_idx in range(total_pages):
        footer_text = escape_pdf_text(f"DOCFORGE Document Intelligence · Page {p_idx + 1} of {total_pages}")
        pages_ops[p_idx].insert(0, f"0.85 0.85 0.88 RG 0.5 w {margin_x:.2f} 805 m {margin_x + max_content_width:.2f} 805 l S\nBT /F1 7.5 Tf 0.5 0.55 0.62 rg {margin_x:.2f} 812 Td ({clean_title}) Tj ET")
        pages_ops[p_idx].append(f"0.85 0.85 0.88 RG 0.5 w {margin_x:.2f} 42 m {margin_x + max_content_width:.2f} 42 l S\nBT /F1 7.5 Tf 0.5 0.55 0.62 rg {margin_x + 160:.2f} 30 Td ({footer_text}) Tj ET")

    parts: list[bytes] = []
    offsets: list[int] = [0]

    def add_obj(obj_num: int, content: str):
        offsets.append(sum(len(p) for p in parts))
        parts.append(f"{obj_num} 0 obj\n{content}\nendobj\n".encode("utf-8"))

    parts.append(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    add_obj(1, "<< /Type /Catalog /Pages 2 0 R >>")

    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(total_pages))
    add_obj(2, f"<< /Type /Pages /Kids [{kids}] /Count {total_pages} >>")

    for i in range(total_pages):
        page_obj = 3 + 2 * i
        stream_obj = 4 + 2 * i
        add_obj(
            page_obj,
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] "
            f"/Resources << /Font << "
            f"/F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> "
            f"/F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> "
            f"/F3 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >> "
            f"/F4 << /Type /Font /Subtype /Type1 /BaseFont /Courier >> "
            f">> >> /Contents {stream_obj} 0 R >>"
        )
        stream_body = "\n".join(pages_ops[i]).encode("utf-8")
        offsets.append(sum(len(p) for p in parts))
        parts.append(f"{stream_obj} 0 obj\n<< /Length {len(stream_body)} >>\nstream\n".encode("utf-8"))
        parts.append(stream_body)
        parts.append(b"\nendstream\nendobj\n")

    start_xref = sum(len(p) for p in parts)
    total_objs = 2 + 2 * total_pages
    xref_lines = [f"xref\n0 {total_objs + 1}\n0000000000 65535 f \n"]
    for o in range(1, total_objs + 1):
        off = offsets[o] if o < len(offsets) else 0
        xref_lines.append(f"{off:010d} 00000 n \n")
    xref_lines.append(f"trailer\n<< /Size {total_objs + 1} /Root 1 0 R >>\nstartxref\n{start_xref}\n%%EOF\n")
    parts.append("".join(xref_lines).encode("utf-8"))

    return b"".join(parts)

# Test PDF generation and validation
sample_md = """# Sample Technical Report
## Introduction & Background
This is a test of DOCFORGE vector PDF export engine.
It preserves:
* Headings and sub-headings
* Bullet points and numbered items
* Clean A4 page boundaries and margins
* Vector fonts (Helvetica and Courier)

> High-reliability document intelligence pipeline with zero truncation.

### Performance Benchmark Table
| Metric | Baseline | DOCFORGE |
| Accuracy | 92.4% | 99.8% |
| Extraction Time | 14.2s | 1.8s |
| Memory Overhead | 850MB | 120MB |

```python
def verify_pipeline():
    assert True == True
    return "All systems operational"
```

<!-- Page 2 -->
# Section 2: Mathematical Formulations
Equations and formulas:
E = mc^2 and Gaussian distribution:
f(x) = 1 / (sigma * sqrt(2 * pi)) * exp(- (x - mu)^2 / (2 * sigma^2))

The document concludes with verified extraction completeness.
"""

pdf_bytes = generate_vector_pdf("Sample Technical Report", sample_md)
print(f"Generated PDF bytes length: {len(pdf_bytes)}")
assert pdf_bytes.startswith(b"%PDF-1.4"), "Invalid PDF header!"
assert pdf_bytes.endswith(b"%%EOF\n") or b"%%EOF" in pdf_bytes[-20:], "Invalid PDF trailer!"

reader = PdfReader(io.BytesIO(pdf_bytes))
print(f"PdfReader parsed pages count: {len(reader.pages)}")
for idx, page in enumerate(reader.pages):
    extracted = page.extract_text()
    print(f"Page {idx+1} text length: {len(extracted)}, snippet: {repr(extracted[:100])}")

print("VECTOR PDF VALIDATION SUCCESSFUL!")
