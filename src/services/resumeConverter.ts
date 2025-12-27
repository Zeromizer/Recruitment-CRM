// CGP Resume Converter Service
// Converts candidate resumes to CGP format using Claude AI and company template

export interface CandidateInfo {
  candidateName: string;
  nationality: string;
  gender: string;
  expectedSalary: string;
  noticePeriod: string;
  preparedBy?: string;
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
  const pdfjsLib = await import('pdfjs-dist');
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

// Parse resume with Claude AI via Supabase Edge Function
export async function parseResumeWithAI(
  resumeText: string,
  candidateInfo: CandidateInfo
): Promise<ParsedResume> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured. Please add VITE_SUPABASE_URL to your .env file.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/parse-resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resumeText,
      candidateInfo,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// Escape special XML characters
function escapeXml(text: string | null | undefined): string {
  const str = String(text ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Replace text in XML content (handles text that may be split across XML tags)
function replaceInXml(xml: string, oldText: string, newText: string): string {
  const escaped = escapeXml(newText);
  return xml.split(oldText).join(escaped);
}

// Find the start of a paragraph containing a given position
function findParagraphStart(xml: string, pos: number): number {
  let searchPos = pos;
  while (searchPos > 0) {
    const pStart = xml.lastIndexOf('<w:p ', searchPos);
    const pStartSimple = xml.lastIndexOf('<w:p>', searchPos);
    const found = Math.max(pStart, pStartSimple);
    if (found >= 0) {
      return found;
    }
    searchPos -= 100;
  }
  return 0;
}

// Find the start of a table containing a given position
function findTableStart(xml: string, pos: number): number {
  const tblStart = xml.lastIndexOf('<w:tbl', pos);
  if (tblStart >= 0) {
    return tblStart;
  }
  // If no table, find paragraph
  return findParagraphStart(xml, pos);
}

// Build work experience section XML matching template format
function buildWorkExperienceXml(jobs: ParsedResume['workExperience']): string {
  if (!jobs || jobs.length === 0) {
    return '';
  }

  let xml = '';
  jobs.forEach(job => {
    // Job title paragraph (bold)
    xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
      <w:pPr>
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
      </w:pPr>
      <w:r w:rsidRPr="0016745D">
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(job.title)}</w:t>
      </w:r>
    </w:p>`;

    // Period paragraph
    xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
      <w:pPr>
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
      </w:pPr>
      <w:r w:rsidRPr="0016745D">
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(job.period)}</w:t>
      </w:r>
    </w:p>`;

    // Company paragraph (bold)
    xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
      <w:pPr>
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
      </w:pPr>
      <w:r w:rsidRPr="0016745D">
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:b/>
          <w:bCs/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(job.company)}</w:t>
      </w:r>
    </w:p>`;

    // Responsibilities as bullet points
    const responsibilities = Array.isArray(job.responsibilities) ? job.responsibilities : [];
    responsibilities.forEach(resp => {
      xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
        <w:pPr>
          <w:pStyle w:val="ListParagraph"/>
          <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="45"/>
          </w:numPr>
          <w:rPr>
            <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
            <w:sz w:val="22"/>
            <w:szCs w:val="22"/>
          </w:rPr>
        </w:pPr>
        <w:r w:rsidRPr="0016745D">
          <w:rPr>
            <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
            <w:sz w:val="22"/>
            <w:szCs w:val="22"/>
          </w:rPr>
          <w:t>${escapeXml(resp)}</w:t>
        </w:r>
      </w:p>`;
    });

    // Empty paragraph for spacing between jobs
    xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
      <w:pPr>
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
      </w:pPr>
    </w:p>`;
  });

  return xml;
}

// Build languages section XML matching template format
function buildLanguagesXml(languages: string[]): string {
  if (!languages || languages.length === 0) {
    return '';
  }

  let xml = '';
  languages.forEach(lang => {
    xml += `<w:p w:rsidR="00C96481" w:rsidRPr="0016745D" w:rsidRDefault="00C96481" w:rsidP="00C96481">
      <w:pPr>
        <w:pStyle w:val="ListParagraph"/>
        <w:numPr>
          <w:ilvl w:val="0"/>
          <w:numId w:val="45"/>
        </w:numPr>
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
      </w:pPr>
      <w:r w:rsidRPr="0016745D">
        <w:rPr>
          <w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>
          <w:sz w:val="22"/>
          <w:szCs w:val="22"/>
        </w:rPr>
        <w:t>${escapeXml(lang)}</w:t>
      </w:r>
    </w:p>`;
  });

  return xml;
}

// Generate CGP formatted Word document using template replacement
export async function generateCGPDocument(data: ParsedResume, preparedBy: string = 'CGP Personnel'): Promise<Blob> {
  const JSZip = (await import('jszip')).default;

  // Fetch the template from public folder (use BASE_URL for correct path in production)
  const baseUrl = import.meta.env.BASE_URL || '/';
  const templateUrl = `${baseUrl}template.docx.b64`.replace('//', '/');
  const templateResponse = await fetch(templateUrl);
  if (!templateResponse.ok) {
    throw new Error(`Failed to load CGP template from ${templateUrl}. Please ensure template.docx.b64 is in the public folder.`);
  }

  const templateBase64 = await templateResponse.text();

  // Decode base64 to binary
  const binaryString = atob(templateBase64.trim());
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Load the template as a zip
  const zip = await JSZip.loadAsync(bytes);

  // Get the document.xml content
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Invalid template: document.xml not found');
  }

  let docXml = await documentXmlFile.async('string');

  // Ensure arrays are valid
  const education = Array.isArray(data.education) ? data.education : [];
  const workExperience = Array.isArray(data.workExperience) ? data.workExperience : [];
  const languages = Array.isArray(data.languages) ? data.languages : ['English'];

  // ===== REPLACE PERSONAL INFO PLACEHOLDERS =====
  // These are the exact placeholders from the CGP template
  docXml = replaceInXml(docXml, 'Yap Hui Mei, Jovial', data.candidateName || '');
  docXml = replaceInXml(docXml, 'Singaporean', data.nationality || '');

  // Gender might be split across XML tags, handle both cases
  docXml = replaceInXml(docXml, 'Female', data.gender || '');
  // Also handle split gender tag like ">Fem<" and ">ale<"
  if (docXml.includes('>Fem<')) {
    docXml = docXml.replace(/>Fem<\/w:t><\/w:r><w:r[^>]*><w:t>ale</g, `>${escapeXml(data.gender || '')}`);
  }

  // Salary and notice period
  docXml = replaceInXml(docXml, '7,500 (Negotiable)', data.expectedSalary || '');
  docXml = replaceInXml(docXml, '$X,000', data.expectedSalary || '');
  docXml = replaceInXml(docXml, 'Immediate', data.noticePeriod || '');
  docXml = replaceInXml(docXml, 'X months', data.noticePeriod || '');

  // Prepared by
  docXml = replaceInXml(docXml, 'preparedByXXXX', preparedBy);

  // ===== REPLACE EDUCATION PLACEHOLDERS =====
  if (education.length > 0) {
    // Replace first education entry placeholders
    docXml = replaceInXml(docXml, '2013', education[0]?.year || '');
    docXml = replaceInXml(docXml, 'Bachelor of Commerce', education[0]?.qualification || '');
    // Remove extra text that might be in the template
    docXml = docXml.replace(/,? ?Double Major in HRM and Tourism and Hospitality ?/g, '');
    docXml = replaceInXml(docXml, 'Murdoch University', education[0]?.institution || '');
  }

  // ===== BUILD AND INSERT WORK EXPERIENCE SECTION =====
  const workExpXml = buildWorkExperienceXml(workExperience);

  // Find work experience section boundaries
  // The template uses "Country HR" as a marker in the sample work experience
  const workExpStart = docXml.indexOf('Country HR');
  const langStart = docXml.indexOf('LANGUAGE');

  if (workExpStart > 0 && langStart > workExpStart) {
    // Find paragraph start before "Country HR"
    const beforeWorkExp = docXml.substring(0, findParagraphStart(docXml, workExpStart));
    // Find table/paragraph start at LANGUAGE section
    const afterLang = docXml.substring(findTableStart(docXml, langStart));

    docXml = beforeWorkExp + workExpXml + afterLang;
  }

  // ===== BUILD AND INSERT LANGUAGES SECTION =====
  const languagesXml = buildLanguagesXml(languages);

  // Find the LANGUAGE section and replace the English bullet
  const langSectionMatch = docXml.match(/>LANGUAGE<\/w:t>/);
  if (langSectionMatch) {
    const langPos = docXml.indexOf('>LANGUAGE</w:t>');
    const afterLang = docXml.substring(langPos);

    // Find and replace the "English" bullet point
    const englishMatch = afterLang.match(
      /<w:p[^>]*>(?:[^<]*<[^>]*>)*[^<]*>English<\/w:t>[^<]*<\/w:r><\/w:p>/
    );

    if (englishMatch) {
      const englishPos = docXml.indexOf(englishMatch[0]);
      const beforeEnglish = docXml.substring(0, englishPos);
      const afterEnglish = docXml.substring(englishPos + englishMatch[0].length);
      docXml = beforeEnglish + languagesXml + afterEnglish;
    }
  }

  // Update the document.xml in the zip
  zip.file('word/document.xml', docXml);

  // Generate the output blob
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

// Full conversion workflow
export async function convertResumeToCGP(
  resumeSource: File | string,
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

  // Step 3: Generate CGP document using template
  const documentBlob = await generateCGPDocument(parsedResume, candidateInfo.preparedBy || 'CGP Personnel');

  return { parsedResume, documentBlob };
}
