"""Resume text extraction utilities."""
from io import BytesIO
import PyPDF2


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
