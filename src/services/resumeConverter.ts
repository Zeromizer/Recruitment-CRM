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

// Template and logo file names in Supabase storage
const TEMPLATE_BUCKET = 'templates';
const TEMPLATE_FILE = 'CGP template.docx';
const LOGO_FILE = 'cgp-personnel-logos_cgp-personnel-logo-color.png';

// Cache for template data
let templateCache: { zip: any; logoData: ArrayBuffer | null } | null = null;

// Download template from Supabase storage
async function downloadTemplate(): Promise<{ zip: any; logoData: ArrayBuffer | null }> {
  if (templateCache) {
    return templateCache;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration missing. Please check your environment variables.');
  }

  const JSZip = (await import('jszip')).default;

  // Download template DOCX
  const templateUrl = `${supabaseUrl}/storage/v1/object/public/${TEMPLATE_BUCKET}/${encodeURIComponent(TEMPLATE_FILE)}`;
  const templateResponse = await fetch(templateUrl);

  if (!templateResponse.ok) {
    throw new Error(`Failed to download template: ${templateResponse.statusText}`);
  }

  const templateBlob = await templateResponse.blob();
  const zip = await JSZip.loadAsync(templateBlob);

  // Download logo
  let logoData: ArrayBuffer | null = null;
  try {
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/${TEMPLATE_BUCKET}/${encodeURIComponent(LOGO_FILE)}`;
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      logoData = await logoResponse.arrayBuffer();
    }
  } catch (e) {
    console.warn('Could not load logo:', e);
  }

  templateCache = { zip, logoData };
  return templateCache;
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

// Generate CGP formatted Word document using template
export async function generateCGPDocument(data: ParsedResume, preparedBy: string = 'CGP Personnel'): Promise<Blob> {
  const JSZip = (await import('jszip')).default;

  // Download template from Supabase
  const { zip: templateZip, logoData } = await downloadTemplate();

  // Clone the template zip
  const newZip = new JSZip();

  // Copy all files from template except document.xml (we'll generate new content)
  const files = Object.keys(templateZip.files);

  for (const fileName of files) {
    if (fileName === 'word/document.xml') {
      // Generate new document content
      continue;
    }

    const file = templateZip.files[fileName];
    if (!file.dir) {
      const content = await file.async('arraybuffer');
      newZip.file(fileName, content);
    }
  }

  // Check if template has logo image, if not add it
  const hasLogo = files.some(f => f.includes('media/image'));
  if (!hasLogo && logoData) {
    newZip.file('word/media/image1.png', logoData);

    // Update content types to include PNG
    const contentTypesFile = templateZip.files['[Content_Types].xml'];
    if (contentTypesFile) {
      let contentTypes = await contentTypesFile.async('string');
      if (!contentTypes.includes('Extension="png"')) {
        contentTypes = contentTypes.replace(
          '</Types>',
          '<Default Extension="png" ContentType="image/png"/></Types>'
        );
        newZip.file('[Content_Types].xml', contentTypes);
      }
    }
  }

  // Generate new document.xml with CGP format
  const documentXml = generateCGPDocumentXml(data, preparedBy);
  newZip.file('word/document.xml', documentXml);

  // Update document relationships if needed
  await ensureDocumentRels(newZip, templateZip);

  return newZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

async function ensureDocumentRels(newZip: any, templateZip: any): Promise<void> {
  const relsPath = 'word/_rels/document.xml.rels';
  const templateRels = templateZip.files[relsPath];

  if (templateRels) {
    // Use template's relationships as they include image references
    const content = await templateRels.async('string');
    newZip.file(relsPath, content);
  }
}

function escapeXml(text: string | null | undefined): string {
  const str = String(text ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateCGPDocumentXml(data: ParsedResume, preparedBy: string): string {
  // Ensure arrays are valid
  const education = Array.isArray(data.education) ? data.education : [];
  const workExperience = Array.isArray(data.workExperience) ? data.workExperience : [];
  const languages = Array.isArray(data.languages) ? data.languages : ['English'];

  // CGP brand color
  const cgpRed = 'CC3300';

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>`;

  // ===== HEADER SECTION WITH LOGO AND COMPANY INFO =====
  xml += `
<!-- Header Table with Logo and Company Info -->
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblLook w:val="04A0"/>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="4500"/>
    <w:gridCol w:w="5500"/>
  </w:tblGrid>
  <w:tr>
    <w:tc>
      <w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>
      <w:p>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0">
              <wp:extent cx="2286000" cy="571500"/>
              <wp:docPr id="1" name="CGP Logo"/>
              <a:graphic>
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic>
                    <pic:nvPicPr>
                      <pic:cNvPr id="1" name="logo.png"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="rId7"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm>
                        <a:off x="0" y="0"/>
                        <a:ext cx="2286000" cy="571500"/>
                      </a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr><w:tcW w:w="5500" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:jc w:val="right"/></w:pPr>
        <w:r><w:rPr><w:b/><w:color w:val="${cgpRed}"/><w:sz w:val="22"/></w:rPr><w:t>Cornerstone Global Partners Pte Ltd</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Prepared by: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>${escapeXml(preparedBy)}</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Company Registration Number: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>201622755N</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>EA Licence: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>19C9859</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Registration No: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>R1440661</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Address: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>79 Anson Road, #17-01</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Telephone: </w:t></w:r>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>+65 90033765</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:jc w:val="right"/><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:color w:val="${cgpRed}"/><w:sz w:val="16"/></w:rPr><w:t>Website: </w:t></w:r>
        <w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/><w:sz w:val="16"/></w:rPr><w:t>https://www.cgpo2o.com/</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>`;

  // ===== HORIZONTAL LINE =====
  xml += `
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:bottom w:val="single" w:sz="12" w:space="1" w:color="${cgpRed}"/>
    </w:pBdr>
    <w:spacing w:before="200" w:after="200"/>
  </w:pPr>
</w:p>`;

  // ===== PERSONAL INFORMATION TABLE =====
  xml += `
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblLook w:val="04A0"/>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="2500"/>
    <w:gridCol w:w="500"/>
    <w:gridCol w:w="7000"/>
  </w:tblGrid>`;

  // Personal info rows
  const personalInfo = [
    ['Candidate Name', data.candidateName],
    ['Nationality', data.nationality],
    ['Gender', data.gender],
    ['Expected Salary', data.expectedSalary],
    ['Notice Period', data.noticePeriod]
  ];

  personalInfo.forEach(([label, value]) => {
    xml += `
  <w:tr>
    <w:tc>
      <w:tcPr><w:tcW w:w="2500" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(label)}</w:t></w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr><w:tcW w:w="500" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
        <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>:</w:t></w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr><w:tcW w:w="7000" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="60"/></w:pPr>
        <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(value)}</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>`;
  });

  xml += `
</w:tbl>`;

  // ===== EDUCATION SECTION =====
  xml += generateSectionHeader('EDUCATION', cgpRed);

  // Education table
  xml += `
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblLook w:val="04A0"/>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="2000"/>
    <w:gridCol w:w="8000"/>
  </w:tblGrid>`;

  education.forEach(edu => {
    xml += `
  <w:tr>
    <w:tc>
      <w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="120"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(edu?.year)}</w:t></w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr><w:tcW w:w="8000" w:type="dxa"/></w:tcPr>
      <w:p><w:pPr><w:spacing w:after="0"/></w:pPr>
        <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(edu?.qualification)}</w:t></w:r>
      </w:p>
      <w:p><w:pPr><w:spacing w:after="120"/></w:pPr>
        <w:r><w:rPr><w:i/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(edu?.institution)}</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>`;
  });

  xml += `
</w:tbl>`;

  // ===== WORKING EXPERIENCE SECTION =====
  xml += generateSectionHeader('WORKING EXPERIENCE', cgpRed);

  workExperience.forEach(job => {
    // Job title
    xml += `
<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(job?.title)}</w:t></w:r>
</w:p>`;

    // Period
    xml += `
<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>
  <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(job?.period)}</w:t></w:r>
</w:p>`;

    // Company
    xml += `
<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(job?.company)}</w:t></w:r>
</w:p>`;

    // Responsibilities as bullet points
    const responsibilities = Array.isArray(job?.responsibilities) ? job.responsibilities : [];
    responsibilities.forEach(resp => {
      xml += `
<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
    <w:spacing w:after="60"/>
    <w:ind w:left="720" w:hanging="360"/>
  </w:pPr>
  <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(resp)}</w:t></w:r>
</w:p>`;
    });

    // Space after each job
    xml += `<w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>`;
  });

  // ===== LANGUAGES SECTION (if available) =====
  if (languages.length > 0) {
    xml += generateSectionHeader('LANGUAGES', cgpRed);

    languages.forEach(lang => {
      xml += `
<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>
    <w:spacing w:after="60"/>
    <w:ind w:left="720" w:hanging="360"/>
  </w:pPr>
  <w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>${escapeXml(lang)}</w:t></w:r>
</w:p>`;
    });
  }

  // ===== FOOTER =====
  xml += `
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:top w:val="single" w:sz="6" w:space="1" w:color="auto"/>
    </w:pBdr>
    <w:spacing w:before="400"/>
    <w:jc w:val="center"/>
  </w:pPr>
</w:p>
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:jc w:val="center"/>
  </w:tblPr>
  <w:tr>
    <w:tc>
      <w:p><w:pPr><w:jc w:val="left"/></w:pPr>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>上海任仕人力资源有限公司</w:t></w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
        <w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>www.cgpo2o.com</w:t></w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>`;

  // Section properties
  xml += `
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709"/>
  <w:cols w:space="708"/>
</w:sectPr>
</w:body>
</w:document>`;

  return xml;
}

function generateSectionHeader(title: string, color: string): string {
  return `
<w:p>
  <w:pPr>
    <w:shd w:val="clear" w:color="auto" w:fill="${color}"/>
    <w:spacing w:before="300" w:after="120"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:b/>
      <w:color w:val="FFFFFF"/>
      <w:sz w:val="24"/>
    </w:rPr>
    <w:t>${escapeXml(title)}</w:t>
  </w:r>
</w:p>`;
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
