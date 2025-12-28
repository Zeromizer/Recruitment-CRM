"""Resume text extraction utilities."""
from io import BytesIO
import os
import subprocess
import tempfile
import PyPDF2
from docx import Document


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from a PDF file."""
    try:
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


def extract_text_from_word(doc_bytes: bytes) -> str:
    """Extract text content from a Word document (.docx)."""
    try:
        doc = Document(BytesIO(doc_bytes))
        text_parts = []

        # Extract text from paragraphs
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)

        # Extract text from tables
        for table in doc.tables:
            for row in table.rows:
                row_text = []
                for cell in row.cells:
                    if cell.text.strip():
                        row_text.append(cell.text.strip())
                if row_text:
                    text_parts.append(" | ".join(row_text))

        return "\n".join(text_parts).strip()
    except Exception as e:
        print(f"Error extracting Word document text: {e}")
        return ""


def convert_word_to_pdf(doc_bytes: bytes) -> bytes:
    """Convert a Word document to PDF using LibreOffice."""
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Write Word doc to temp file
            input_path = os.path.join(tmp_dir, "input.docx")
            with open(input_path, "wb") as f:
                f.write(doc_bytes)

            # Convert using LibreOffice
            subprocess.run([
                "libreoffice",
                "--headless",
                "--convert-to", "pdf",
                "--outdir", tmp_dir,
                input_path
            ], check=True, capture_output=True, timeout=60)

            # Read the converted PDF
            output_path = os.path.join(tmp_dir, "input.pdf")
            with open(output_path, "rb") as f:
                return f.read()
    except subprocess.TimeoutExpired:
        print("Error: Word to PDF conversion timed out")
        return None
    except Exception as e:
        print(f"Error converting Word to PDF: {e}")
        return None
