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

  // ===== REPLACE WORK EXPERIENCE =====
  // Template has 6 jobs with sample data - we need to replace or clear ALL of them

  // Define all sample jobs from the template
  const templateJobs = [
    {
      title: 'Country HR',
      period: 'May 2023 till Aug 2025',
      company: 'Eviden Singapore Pte Ltd (separated entity from Atos to Eviden)',
      responsibilities: [
        "Main point of contact for employees' queries on HR-related topics. In charge and support SG HR operations and HRBP with approximately 40 over employees",
        'Manage Singapore and South Korea payroll',
        "Performance management, liaising with the respective business heads/managers for employee's performance rating, involve in bonus payout, ensuring the accuracy of payout.",
        'Maintain compliance with labor laws, company policies, and industry regulations',
        'Support business leaders during periods of change (such as restructuring, mergers, or new technology adoption), helping to guide the organization and employees through transitions.',
        'As a HRBP work closely with business leaders and managers to offer guidance on various HR issues, such as employee relations, talent management, performance management, and organizational development'
      ]
    },
    {
      title: 'HR Generalist',
      period: 'March 2020 till April 2023',
      company: 'Atos Information Technology (Singapore) Pte Ltd',
      responsibilities: [
        'Act as the main point of contact for employee queries regarding HR topics, supporting SG HR operations for approximately 200 employees.',
        'Provided guidance and led HR peers in the absence of the HR Manager for 4 to 5 months.',
        'Supported global HR transitions for mandatory and digital training initiatives.',
        'Coordinated with the global learning and development shared services team on training activities.',
        'Managed local government training incentives, funding programs, and internship programs.',
        'Oversaw onsite and virtual training coordination for mandatory and digital programs.',
        'Managed employee performance assessments and confirmations.',
        'Assisted the HR Manager with performance management review activities.',
        'Organized and facilitated onboarding programs and conducted new hire orientation.',
        'Handled offboarding and employee separation processes.',
        'Served as the contact point for government matters such as COVID-19 and work pass applications/renewals.',
        'Managed employee benefits, medical insurance, and conducted briefings on group medical insurance.',
        'Ensured internal policies were in line with government regulations.',
        'Acted as the contact point for HR-related audits and supported employee background checks.',
        'Involved in facilitating GPTW survey and CSAT HR surveys.',
        'Organized and coordinated employee engagement programs, including Townhalls, Workplace Health Programs, Atos Week Programs, and Awards Presentations.'
      ]
    },
    {
      title: 'Senior HR Executive',
      period: 'April 2019 till Mar 2020',
      company: 'Jardine Engineering Singapore Pte Ltd',
      responsibilities: [
        'Identified training and development needs through consultation with business units and job analysis.',
        'Designed and implemented a training skills framework.',
        'Collaborated with stakeholders to organize and conduct quarterly staff onboarding programs.',
        'Managed and coordinated employee orientation for new recruits.',
        'Initiated and drove graduate recruitment events in collaboration with universities.',
        'Achieved cost savings by designing in-house recruitment materials.',
        'Responsible for internship and management trainee programs.',
        'Acted as liaison with educational institutions for internships and training attachments.',
        'Handled training-related matters with government agencies, including grants.',
        'Maintained employees\' training records and calendar, monitored training expenditures, and managed training administration duties.'
      ]
    },
    {
      title: 'Senior HR Executive',
      period: 'Feb 2018 till March 2019',
      company: 'Young Women\'s Christian Association, YWCA',
      responsibilities: [
        'Initiated and led recruitment strategies, organizing job fairs in collaboration with WSG and e2i.',
        'Achieved cost savings by designing in-house recruitment materials.',
        'Supported 7 departments in manpower hiring and staff matters.',
        'Reviewed and implemented staff training and development policies.',
        'Responsible for staff training programs and in-house training facilitation.',
        'Presented topics on Effective Communication Skills and Customer Service during monthly celebrations.',
        'Advised department heads on employment laws and staff counseling, conducting multiple counseling sessions.'
      ]
    },
    {
      title: 'Senior Executive, HR',
      period: 'Aug 2017 to Feb 2018',
      company: 'Econ Healthcare Pte Ltd, Specialised in Learning and Development',
      responsibilities: [
        'Organized and facilitated orientation programs to align with company objectives.',
        'Developed and administered training plans to ensure employee skill competency.',
        'Identified training needs through annual appraisals and collaborated with stakeholders.',
        'Supported the HR Manager in annual D&D Best Employee Award and Staff Incentive programs.',
        'Successfully organized staff Christmas celebrations.'
      ]
    },
    {
      title: 'Senior Executive, HR',
      period: 'Dec 2016 – Aug 2017',
      company: '',
      responsibilities: []
    },
    {
      title: 'Human Resource Executive',
      period: 'Feb 2012 – Dec 2016',
      company: '',
      responsibilities: []
    }
  ];

  // Replace each template job with actual data or clear it
  for (let i = 0; i < templateJobs.length; i++) {
    const templateJob = templateJobs[i];
    const actualJob = workExperience[i];

    if (actualJob) {
      // Replace with actual data
      docXml = replaceInXml(docXml, templateJob.title, actualJob.title || '');
      docXml = replaceInXml(docXml, templateJob.period, actualJob.period || '');
      if (templateJob.company) {
        docXml = replaceInXml(docXml, templateJob.company, actualJob.company || '');
      }

      // Replace responsibilities
      const actualResps = actualJob.responsibilities || [];
      for (let j = 0; j < templateJob.responsibilities.length; j++) {
        const replacement = actualResps[j] || '';
        docXml = replaceInXml(docXml, templateJob.responsibilities[j], replacement);
      }
    } else {
      // No actual job for this slot - clear the template data
      docXml = replaceInXml(docXml, templateJob.title, '');
      docXml = replaceInXml(docXml, templateJob.period, '');
      if (templateJob.company) {
        docXml = replaceInXml(docXml, templateJob.company, '');
      }
      for (const resp of templateJob.responsibilities) {
        docXml = replaceInXml(docXml, resp, '');
      }
    }
  }

  // ===== REPLACE LANGUAGES - SIMPLE TEXT REPLACEMENT =====
  // Replace sample language with first language from parsed data
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
