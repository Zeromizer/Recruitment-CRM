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

// Build XML for a single job entry
function buildJobXml(job: { title: string; period: string; company: string; responsibilities: string[] }): string {
  let xml = '';

  // Job title (bold)
  xml += `<w:p><w:pPr><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(job.title)}</w:t></w:r></w:p>`;

  // Period
  xml += `<w:p><w:pPr><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(job.period)}</w:t></w:r></w:p>`;

  // Company (bold)
  xml += `<w:p><w:pPr><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(job.company)}</w:t></w:r></w:p>`;

  // Responsibilities (bullet points)
  for (const resp of job.responsibilities) {
    xml += `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="45"/></w:numPr><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(resp)}</w:t></w:r></w:p>`;
  }

  // Empty paragraph for spacing
  xml += `<w:p><w:pPr><w:rPr><w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr></w:p>`;

  return xml;
}

// Build XML for all work experience
function buildAllWorkExperienceXml(jobs: ParsedResume['workExperience']): string {
  let xml = '';
  for (const job of jobs) {
    xml += buildJobXml(job);
  }
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
    docXml = docXml.replace(/,? ?Double Major in HRM and Tourism and Hospitality/g, '');
    docXml = replaceInXml(docXml, 'Murdoch University', education[0]?.institution || '');
  }

  // ===== REPLACE WORK EXPERIENCE - DYNAMIC INJECTION =====
  // Find the WORKING EXPERIENCE header table end and LANGUAGE section start
  // Then replace everything between with dynamically generated content

  const workExpHeaderPos = docXml.indexOf('WORKING EXPERIENCE');
  const langSectionPos = docXml.indexOf('LANGUAGE');

  if (workExpHeaderPos > 0 && langSectionPos > workExpHeaderPos) {
    // Find the end of the WORKING EXPERIENCE header table (</w:tbl> after the header)
    const afterWorkExpHeader = docXml.substring(workExpHeaderPos);
    const tblEndOffset = afterWorkExpHeader.indexOf('</w:tbl>');

    if (tblEndOffset > 0) {
      const workExpContentStart = workExpHeaderPos + tblEndOffset + 8; // 8 = length of '</w:tbl>'

      // Find the start of the LANGUAGE section table (<w:tbl before LANGUAGE)
      // We need to search in the original string up to langSectionPos
      const beforeLangSection = docXml.substring(0, langSectionPos);
      const langTblStart = beforeLangSection.lastIndexOf('<w:tbl');

      if (langTblStart > workExpContentStart) {
        // Build the new work experience content
        const workExpXml = buildAllWorkExperienceXml(workExperience);

        // Replace the content between the sections
        const beforeContent = docXml.substring(0, workExpContentStart);
        const afterContent = docXml.substring(langTblStart);

        docXml = beforeContent + workExpXml + afterContent;
      }
    }
  }

  // ===== REPLACE LANGUAGES - SIMPLE TEXT REPLACEMENT =====
  // Just replace "English" with all languages (safer than XML injection)
  if (languages.length > 0) {
    docXml = replaceInXml(docXml, 'English', languages.join(', '));
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
