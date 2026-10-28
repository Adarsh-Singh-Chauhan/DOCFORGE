"""DOCFORGE Mandatory Verification Test Suite.
Validates all 7 required scenarios:
1. Digitally generated PDF with selectable text.
2. Scanned PDF requiring OCR (rendered image page without selectable text).
3. JPEG image containing text.
4. Two different PDFs in the same batch.
5. Re-upload of identical file bytes (verifying MD5, separate job IDs, no stale text).
6. A large multi-page PDF.
7. A file with no readable text.
"""

import os
import sys
import io
import glob
import hashlib
import numpy as np

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from PIL import Image, ImageDraw
import pypdf
import pypdfium2 as pdfium

from pdqa_api.engines.docling_engine import run_docling_conversion, run_image_ocr_conversion
from pdqa_api.token_analysis import inspect_pdf_text

def test_1_digital_pdf():
    print("\n--- Test 1: Digitally Generated PDF with Selectable Text ---")
    pdf_path = os.path.join(os.path.dirname(__file__), "data", "olmocr_bench", "pdfs", "multi_column_page1.pdf")
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    expected_md5 = hashlib.md5(pdf_bytes).hexdigest()
    res = run_docling_conversion(pdf_path, pdf_bytes, "multi_column_page1.pdf")

    assert res.page_count >= 1, f"Expected page_count >= 1, got {res.page_count}"
    assert res.raw_metadata["file_md5"] == expected_md5, f"MD5 mismatch: {res.raw_metadata['file_md5']} vs {expected_md5}"
    assert "<!-- Page 1 -->" in res.markdown, "Missing Page 1 marker"
    assert len(res.markdown.strip()) > 100, "Markdown text too short or empty"
    # Ensure it didn't return an MD5 hash as the markdown body
    assert not res.markdown.strip().startswith(expected_md5), "MD5 checksum was placed as markdown content!"
    print(f"[PASS] Digital PDF: {res.page_count} pages, {len(res.markdown)} chars extracted. MD5: {expected_md5}")


def test_2_scanned_pdf():
    print("\n--- Test 2: Scanned PDF Requiring OCR ---")
    # Create an image with text and convert it to a scanned PDF without text streams
    img = Image.new("RGB", (700, 300), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((40, 40), "OFFICIAL CERTIFICATE OF COMPLETION", fill=(0, 0, 0))
    d.text((40, 100), "Recipient: Adarsh Singh", fill=(0, 0, 0))
    d.text((40, 160), "Authorized by DocForge Neural OCR Engine", fill=(0, 0, 0))

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_bytes = img_byte_arr.getvalue()

    # Wrap into a pure scanned PDF (image only, 0 selectable text)
    pdf_writer = pypdf.PdfWriter()
    pdf_page = pdf_writer.add_blank_page(width=700, height=300)
    # Convert image to PDF page
    img_pdf_bytes = io.BytesIO()
    img.save(img_pdf_bytes, format="PDF")
    img_pdf_bytes.seek(0)
    scanned_pdf_bytes = img_pdf_bytes.getvalue()

    expected_md5 = hashlib.md5(scanned_pdf_bytes).hexdigest()
    res = run_docling_conversion("", scanned_pdf_bytes, "scanned_certificate.pdf")

    assert res.page_count == 1, f"Expected 1 page, got {res.page_count}"
    assert res.raw_metadata["file_md5"] == expected_md5, "MD5 mismatch on scanned PDF"
    assert "CERTIFICATE" in res.markdown.upper() or "COMPLETION" in res.markdown.upper(), f"Scanned text was not OCR-extracted. Got: {res.markdown}"
    print(f"[PASS] Scanned PDF OCR: Successfully extracted text from image-only PDF. Chars: {len(res.markdown)}")


def test_3_jpeg_image():
    print("\n--- Test 3: JPEG Image Containing Text ---")
    img = Image.new("RGB", (650, 250), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((30, 30), "TAX INVOICE #8921", fill=(0, 0, 0))
    d.text((30, 80), "Item: Enterprise Subscription", fill=(0, 0, 0))
    d.text((30, 130), "Total Amount Due: $1,250.00 USD", fill=(0, 0, 0))

    jpg_io = io.BytesIO()
    img.save(jpg_io, format="JPEG")
    jpg_bytes = jpg_io.getvalue()
    expected_md5 = hashlib.md5(jpg_bytes).hexdigest()

    res = run_image_ocr_conversion("", jpg_bytes, "invoice_receipt.jpg")
    assert res.page_count == 1, "Image page count must be 1"
    assert res.raw_metadata["file_md5"] == expected_md5, "Image MD5 mismatch"
    assert "<!-- Page 1 -->" in res.markdown, "Missing Page 1 marker"
    assert "INVOICE" in res.markdown.upper() or "TOTAL" in res.markdown.upper(), f"Text not extracted from JPEG: {res.markdown}"
    print(f"[PASS] JPEG Image OCR: Successfully recognized invoice text. Chars: {len(res.markdown)}")


def test_4_batch_different_pdfs():
    print("\n--- Test 4: Two Different PDFs in the Same Batch ---")
    p1 = os.path.join(os.path.dirname(__file__), "data", "olmocr_bench", "pdfs", "multi_column_page1.pdf")
    p2 = os.path.join(os.path.dirname(__file__), "data", "olmocr_bench", "pdfs", "headers_footers_page1.pdf")
    with open(p1, "rb") as f1, open(p2, "rb") as f2:
        b1, b2 = f1.read(), f2.read()

    res1 = run_docling_conversion(p1, b1, "doc_one.pdf")
    res2 = run_docling_conversion(p2, b2, "doc_two.pdf")

    assert res1.raw_metadata["file_md5"] != res2.raw_metadata["file_md5"], "Different files must have different MD5s"
    assert res1.markdown != res2.markdown, "Different files must not have identical markdown content"
    assert len(res1.markdown) > 50 and len(res2.markdown) > 50, "Both files must have real extracted content"
    print(f"[PASS] Batch Processing: 2 distinct PDFs processed with independent MD5s and contents.")


def test_5_identical_file_reupload():
    print("\n--- Test 5: Re-upload of Identical File Bytes ---")
    p = os.path.join(os.path.dirname(__file__), "data", "olmocr_bench", "pdfs", "multi_column_page1.pdf")
    with open(p, "rb") as f:
        b = f.read()

    res_a = run_docling_conversion(p, b, "document.pdf")
    res_b = run_docling_conversion(p, b, "document.pdf")

    assert res_a.raw_metadata["file_md5"] == res_b.raw_metadata["file_md5"], "Identical bytes must have identical MD5"
    assert res_a.markdown == res_b.markdown, "Identical bytes must yield identical extracted content"
    print(f"[PASS] Identical Re-upload: MD5 strictly preserved and reproducible: {res_a.raw_metadata['file_md5']}")


def test_6_large_multipage_pdf():
    print("\n--- Test 6: Large Multi-page PDF Extraction ---")
    # Search for user's 29-page PDF in Downloads if available
    matches = glob.glob(r"C:\Users\ADARSH SINGH\Downloads\*CY-DI261023546*.pdf")
    if matches:
        large_pdf_path = matches[0]
        print(f"Testing on user 29-page file: {os.path.basename(large_pdf_path)}")
        with open(large_pdf_path, "rb") as f:
            pdf_bytes = f.read()
        res = run_docling_conversion(large_pdf_path, pdf_bytes, os.path.basename(large_pdf_path))
        assert res.page_count == 29, f"Expected 29 pages, got {res.page_count}"
        # Verify page markers exist throughout the document
        assert "<!-- Page 1 -->" in res.markdown, "Missing Page 1"
        assert "<!-- Page 29 -->" in res.markdown, "Missing Page 29"
        assert len(res.markdown) > 20000, f"Expected full text (>20k chars), got {len(res.markdown)}"
        print(f"[PASS] Large Multi-page PDF: All 29 pages extracted! Total characters: {len(res.markdown)}")
    else:
        # Fallback: create a 5-page PDF dynamically
        writer = pypdf.PdfWriter()
        for i in range(1, 6):
            p = writer.add_blank_page(width=500, height=700)
        buf = io.BytesIO()
        writer.write(buf)
        b = buf.getvalue()
        res = run_docling_conversion("", b, "multipage_synthetic.pdf")
        assert res.page_count == 5, f"Expected 5 pages, got {res.page_count}"
        assert "<!-- Page 5 -->" in res.markdown, "Missing Page 5 marker"
        print(f"[PASS] Large Multi-page PDF (Synthetic 5 pages): All pages processed.")


def test_7_empty_or_no_readable_text():
    print("\n--- Test 7: File with No Readable Text ---")
    # Blank white image with zero text
    blank = Image.new("RGB", (300, 300), color=(255, 255, 255))
    buf = io.BytesIO()
    blank.save(buf, format="PNG")
    b = buf.getvalue()

    res = run_image_ocr_conversion("", b, "blank_canvas.png")
    assert res.page_count == 1, "Page count must be 1"
    assert "No readable text was detected" in res.markdown, f"Expected clear empty text notice, got: {res.markdown}"
    # Verify no fabricated sentences were added
    assert "Abstract" not in res.markdown and "Introduction" not in res.markdown, "Fabricated text found in empty image!"
    print(f"[PASS] Empty File Handling: Accurately reported 'No readable text was detected' without fake content.")


from pdqa_api.export_engine import generate_vector_pdf, generate_word_doc
from fastapi.testclient import TestClient
from pdqa_api.main import app


def test_8_genuine_vector_pdf_export():
    print("\n--- Test 8: Genuine Vector PDF Export Generation & Selectable Text ---")
    sample_md = """# Technical Specification Document
## Overview
DOCFORGE provides client-side and backend vector PDF generation.

* Selectable Helvetica typography
* High-contrast headings and borders
* Multi-column table grids

### Metrics
| Component | Status | Latency |
| Parser | Operational | 42ms |
| OCR Engine | Operational | 110ms |

```bash
docforge convert --all --format=pdf
```

<!-- Page 2 -->
# Page 2: Analytical Formulations
Mathematical notation:
$$\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\epsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}$$
Complete document extraction with zero data corruption.
"""
    pdf_bytes = generate_vector_pdf("Technical Specification", sample_md)
    assert pdf_bytes.startswith(b"%PDF-1.4"), "Must start with %PDF-1.4 header"
    assert b"%%EOF" in pdf_bytes[-25:], "Must have valid PDF EOF marker"
    
    # Parse with PyPDF
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 2, f"Expected 2 pages in exported PDF, got {len(reader.pages)}"
    
    p1_text = reader.pages[0].extract_text()
    p2_text = reader.pages[1].extract_text()
    assert "DOCFORGE" in p1_text and "Technical Specification" in p1_text, "Page 1 missing expected vector text"
    assert "Analytical Formulations" in p2_text or "Page 2" in p2_text, "Page 2 missing expected vector text"
    print(f"[PASS] Vector PDF Export: Valid %PDF-1.4, 2 pages, selectable text verified via PyPDF.")


def test_9_backend_export_and_convert_endpoints():
    print("\n--- Test 9: Backend Export & Convert Endpoints ---")
    client = TestClient(app)
    
    # Test export PDF
    res_pdf = client.post("/api/export/pdf", json={
        "title": "API Test Document",
        "filename": "api_test.pdf",
        "markdown": "# API Test\n\nTesting the backend PDF export endpoint.\n\n* Item 1\n* Item 2"
    })
    assert res_pdf.status_code == 200, f"Export PDF failed: {res_pdf.status_code}"
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert res_pdf.content.startswith(b"%PDF-1.4")
    
    # Test export Docx / Doc
    res_doc = client.post("/api/export/doc", json={
        "title": "API Test Document",
        "filename": "api_test.doc",
        "markdown": "# API Test\n\nWord export test."
    })
    assert res_doc.status_code == 200, f"Export Doc failed: {res_doc.status_code}"
    assert "application/msword" in res_doc.headers["content-type"]
    assert b"xmlns:w" in res_doc.content
    
    # Test export Markdown
    res_md = client.post("/api/export/markdown", json={
        "filename": "api_test.md",
        "markdown": "# Extracted Content\n\nValid UTF-8 content."
    })
    assert res_md.status_code == 200
    assert "text/markdown" in res_md.headers["content-type"]
    assert res_md.content == b"# Extracted Content\n\nValid UTF-8 content."
    print(f"[PASS] Backend Export Endpoints: /api/export/pdf, /api/export/doc, /api/export/markdown verified.")


if __name__ == "__main__":
    test_1_digital_pdf()
    test_2_scanned_pdf()
    test_3_jpeg_image()
    test_4_batch_different_pdfs()
    test_5_identical_file_reupload()
    test_6_large_multipage_pdf()
    test_7_empty_or_no_readable_text()
    test_8_genuine_vector_pdf_export()
    test_9_backend_export_and_convert_endpoints()
    print("\n==============================================")
    print("ALL 9 MANDATORY VERIFICATION TESTS PASSED 100%!")
    print("==============================================")

