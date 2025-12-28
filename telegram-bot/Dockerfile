FROM python:3.11-slim

WORKDIR /app

# Ensure Python output is sent straight to terminal without buffering
ENV PYTHONUNBUFFERED=1

# Install LibreOffice for Word to PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
