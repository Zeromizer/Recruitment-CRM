// CGP Resume Converter Service
// Converts candidate resumes to CGP format using Gemini AI

export interface CandidateInfo {
  candidateName: string;
  nationality: string;
  gender: string;
  expectedSalary: string;
  noticePeriod: string;
}

export interface ParsedResume {
  candidateName: string;
  nationality: string;
  gender: string;
  expectedSalary: string;
  noticePeriod: string;
  education: Array<{
    year: string;
    qualification: string;
    institution: string;
  }>;
  workExperience: Array<{
    title: string;
    period: string;
    company: string;
    responsibilities: string[];
  }>;
  languages: string[];
}

// Extract text from PDF using pdf.js
export async function extractPdfText(file: File): Promise<string> {
  // Dynamically load pdf.js
  const pdfjsLib = await import('pdfjs-dist');

  // Use worker from unpkg CDN matching the installed version
  const pdfjsVersion = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ') + '\n';
  }

  return text;
}

// Extract text from Word document using mammoth
export async function extractWordText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Fetch PDF from URL and convert to text
export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch resume: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const blob = await response.blob();
  const file = new File([blob], 'resume.pdf', { type: contentType });

  if (contentType.includes('pdf')) {
    return extractPdfText(file);
  } else if (contentType.includes('word') || contentType.includes('document')) {
    return extractWordText(file);
  }

  throw new Error('Unsupported document format. Please use PDF or Word documents.');
}

// Parse resume with Claude AI
export async function parseResumeWithAI(
  resumeText: string,
  candidateInfo: CandidateInfo
): Promise<ParsedResume> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const prompt = `You are a resume parser. Extract and structure the following resume into JSON format.

CANDIDATE INFO (use these exact values):
- Name: ${candidateInfo.candidateName}
- Nationality: ${candidateInfo.nationality}
- Gender: ${candidateInfo.gender}
- Expected Salary: ${candidateInfo.expectedSalary}
- Notice Period: ${candidateInfo.noticePeriod}

RESUME TEXT:
${resumeText}

Return ONLY valid JSON (no markdown, no code blocks). Start your response with { and end with }:
{
    "candidateName": "${candidateInfo.candidateName}",
    "nationality": "${candidateInfo.nationality}",
    "gender": "${candidateInfo.gender}",
    "expectedSalary": "${candidateInfo.expectedSalary}",
    "noticePeriod": "${candidateInfo.noticePeriod}",
    "education": [{"year": "2023", "qualification": "Degree Name", "institution": "University Name"}],
    "workExperience": [{"title": "Job Title", "period": "Jan 2022 - Present", "company": "Company Name", "responsibilities": ["Responsibility 1", "Responsibility 2"]}],
    "languages": ["English", "Mandarin", "Cantonese"]
}

RULES:
1. Extract ALL work experiences (most recent first)
2. Extract ALL education entries
3. Each responsibility should be a complete sentence
4. Extract ALL languages mentioned individually (e.g., "English, Mandarin, Cantonese" should be ["English", "Mandarin", "Cantonese"], not consolidated into "Chinese")
5. If no languages mentioned, default to ["English"]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const result = await response.json();
  let jsonStr = result.content?.[0]?.text?.trim();

  if (!jsonStr) {
    throw new Error('No response from Claude API');
  }

  // Clean up response
  if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

  return JSON.parse(jsonStr.trim());
}

// Generate CGP formatted Word document
export async function generateCGPDocument(data: ParsedResume): Promise<Blob> {
  const JSZip = (await import('jszip')).default;

  // Create a new DOCX from scratch
  const zip = new JSZip();

  // Add required DOCX structure
  zip.file('[Content_Types].xml', getContentTypesXml());
  zip.file('_rels/.rels', getRelsXml());
  zip.folder('word');
  zip.file('word/_rels/document.xml.rels', getDocumentRelsXml());
  zip.file('word/styles.xml', getStylesXml());
  zip.file('word/numbering.xml', getNumberingXml());
  zip.file('word/document.xml', generateDocumentXml(data));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateDocumentXml(data: ParsedResume): string {
  let content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>`;

  // Title - Candidate Name
  content += `<w:p><w:pPr><w:jc w:val="center"/><w:pStyle w:val="Title"/></w:pPr>
<w:r><w:rPr><w:b/><w:sz w:val="44"/></w:rPr><w:t>${escapeXml(data.candidateName)}</w:t></w:r></w:p>`;

  // Divider line
  content += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CC3300"/></w:pBdr></w:pPr></w:p>`;

  // Personal Information Section
  content += generateSectionHeader('PERSONAL INFORMATION');
  content += generateInfoRow('Nationality', data.nationality);
  content += generateInfoRow('Gender', data.gender);
  content += generateInfoRow('Expected Salary', data.expectedSalary);
  content += generateInfoRow('Notice Period', data.noticePeriod);

  // Education Section
  content += generateSectionHeader('EDUCATION');
  data.education.forEach(edu => {
    content += `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(edu.year)}</w:t></w:r></w:p>`;
    content += `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
<w:r><w:t>${escapeXml(edu.qualification)}</w:t></w:r></w:p>`;
    content += `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr>
<w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(edu.institution)}</w:t></w:r></w:p>`;
  });

  // Work Experience Section
  content += generateSectionHeader('WORK EXPERIENCE');
  data.workExperience.forEach(job => {
    // Job Title
    content += `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
<w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(job.title)}</w:t></w:r></w:p>`;
    // Period
    content += `<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>${escapeXml(job.period)}</w:t></w:r></w:p>`;
    // Company
    content += `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>
<w:r><w:rPr><w:i/></w:rPr><w:t>${escapeXml(job.company)}</w:t></w:r></w:p>`;
    // Responsibilities (bulleted list)
    job.responsibilities.forEach(resp => {
      content += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
<w:r><w:t>${escapeXml(resp)}</w:t></w:r></w:p>`;
    });
    content += `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;
  });

  // Languages Section
  content += generateSectionHeader('LANGUAGES');
  data.languages.forEach(lang => {
    content += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
<w:r><w:t>${escapeXml(lang)}</w:t></w:r></w:p>`;
  });

  content += `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>`;

  return content;
}

function generateSectionHeader(title: string): string {
  return `<w:p><w:pPr><w:spacing w:before="400" w:after="200"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="1" w:color="CC3300"/></w:pBdr></w:pPr>
<w:r><w:rPr><w:b/><w:color w:val="CC3300"/><w:sz w:val="28"/></w:rPr><w:t>${title}</w:t></w:r></w:p>`;
}

function generateInfoRow(label: string, value: string): string {
  return `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>${label}: </w:t></w:r>
<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`;
}

function getContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;
}

function getRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

function getDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;
}

function getStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:styleId="Title">
<w:name w:val="Title"/>
<w:pPr><w:jc w:val="center"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="44"/></w:rPr>
</w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph">
<w:name w:val="List Paragraph"/>
<w:pPr><w:ind w:left="720"/></w:pPr>
</w:style>
</w:styles>`;
}

function getNumberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0">
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="•"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr>
</w:lvl>
</w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`;
}

// Full conversion workflow
export async function convertResumeToCGP(
  resumeSource: File | string, // File object or URL
  candidateInfo: CandidateInfo
): Promise<{ parsedResume: ParsedResume; documentBlob: Blob }> {
  // Step 1: Extract text from resume
  let resumeText: string;

  if (typeof resumeSource === 'string') {
    resumeText = await extractTextFromUrl(resumeSource);
  } else {
    const fileName = resumeSource.name.toLowerCase();
    if (fileName.endsWith('.pdf')) {
      resumeText = await extractPdfText(resumeSource);
    } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      resumeText = await extractWordText(resumeSource);
    } else {
      throw new Error('Unsupported file format. Please use PDF or Word documents.');
    }
  }

  // Step 2: Parse resume with AI
  const parsedResume = await parseResumeWithAI(resumeText, candidateInfo);

  // Step 3: Generate CGP document
  const documentBlob = await generateCGPDocument(parsedResume);

  return { parsedResume, documentBlob };
}
