import { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Download,
  Briefcase,
  GraduationCap,
  Languages,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { Candidate } from '../types';
import {
  convertResumeToCGP,
  type CandidateInfo,
  type ParsedResume,
} from '../services/resumeConverter';

interface ResumeConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

type ConversionStep = 'form' | 'extracting' | 'parsing' | 'generating' | 'complete' | 'error';

const NATIONALITIES = [
  'Singaporean',
  'Singapore PR',
  'Malaysian',
  'Chinese',
  'Indian',
  'Filipino',
  'Indonesian',
  'Vietnamese',
  'Thai',
  'Myanmar',
  'Other',
];

const NOTICE_PERIODS = [
  'Immediate',
  '1 Week',
  '2 Weeks',
  '1 Month',
  '2 Months',
  '3 Months',
];

export default function ResumeConverterModal({
  isOpen,
  onClose,
  candidate,
}: ResumeConverterModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [useExistingResume, setUseExistingResume] = useState(false);
  const [step, setStep] = useState<ConversionStep>('form');
  const [error, setError] = useState<string | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [documentBlob, setDocumentBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [candidateName, setCandidateName] = useState('');
  const [nationality, setNationality] = useState('');
  const [gender, setGender] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [preparedBy, setPreparedBy] = useState('');

  // Reset form when modal opens with candidate data
  useEffect(() => {
    if (isOpen && candidate) {
      setCandidateName(candidate.full_name || '');
      // Try to detect nationality from citizenship status
      if (candidate.citizenship_status === 'SC') {
        setNationality('Singaporean');
      } else if (candidate.citizenship_status === 'PR') {
        setNationality('Singapore PR');
      } else {
        setNationality('');
      }
      setGender('');
      setExpectedSalary('');
      setNoticePeriod('');
      setPreparedBy('');
      setFile(null);
      setUseExistingResume(!!candidate.resume_url);
      setStep('form');
      setError(null);
      setParsedResume(null);
      setDocumentBlob(null);
    }
  }, [isOpen, candidate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase();
      if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
        setError('Please upload a PDF or Word document');
        return;
      }
      setFile(selectedFile);
      setUseExistingResume(false);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const fileName = droppedFile.name.toLowerCase();
      if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx')) {
        setError('Please upload a PDF or Word document');
        return;
      }
      setFile(droppedFile);
      setUseExistingResume(false);
      setError(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleConvert = async () => {
    // Validate form
    if (!candidateName.trim()) {
      setError('Please enter the candidate name');
      return;
    }
    if (!nationality) {
      setError('Please select nationality');
      return;
    }
    if (!gender) {
      setError('Please select gender');
      return;
    }
    if (!expectedSalary.trim()) {
      setError('Please enter expected salary');
      return;
    }
    if (!noticePeriod) {
      setError('Please select notice period');
      return;
    }

    // Check resume source
    if (!useExistingResume && !file) {
      setError('Please upload a resume or use the existing one');
      return;
    }

    if (useExistingResume && !candidate?.resume_url) {
      setError('No existing resume available. Please upload a resume.');
      return;
    }

    setError(null);
    setStep('extracting');

    try {
      const candidateInfo: CandidateInfo = {
        candidateName: candidateName.trim(),
        nationality,
        gender,
        expectedSalary: expectedSalary.trim(),
        noticePeriod,
        preparedBy: preparedBy.trim() || 'CGP Personnel',
      };

      let resumeSource: File | string;
      if (useExistingResume && candidate?.resume_url) {
        resumeSource = candidate.resume_url;
      } else if (file) {
        resumeSource = file;
      } else {
        throw new Error('No resume source available');
      }

      setStep('parsing');
      const result = await convertResumeToCGP(resumeSource, candidateInfo);

      setStep('generating');
      setParsedResume(result.parsedResume);
      setDocumentBlob(result.documentBlob);
      setStep('complete');
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during conversion');
      setStep('error');
    }
  };

  const handleDownload = () => {
    if (!documentBlob || !parsedResume) return;

    const safeFileName = parsedResume.candidateName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');

    const url = URL.createObjectURL(documentBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName}_CGP_Format.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleStartOver = () => {
    setStep('form');
    setError(null);
    setParsedResume(null);
    setDocumentBlob(null);
  };

  const handleClose = () => {
    setFile(null);
    setCandidateName('');
    setNationality('');
    setGender('');
    setExpectedSalary('');
    setNoticePeriod('');
    setPreparedBy('');
    setStep('form');
    setError(null);
    setParsedResume(null);
    setDocumentBlob(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cgp-red rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">CGP Resume Converter</h2>
              <p className="text-sm text-slate-500">Convert resume to CGP format</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-center gap-2">
            {['Enter Details', 'Process', 'Download'].map((label, idx) => {
              const stepMap: Record<ConversionStep, number> = {
                form: 0,
                extracting: 1,
                parsing: 1,
                generating: 1,
                complete: 2,
                error: step === 'error' ? 1 : 0,
              };
              const currentStep = stepMap[step];
              const isCompleted = idx < currentStep;
              const isCurrent = idx === currentStep;

              return (
                <div key={label} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                      isCompleted
                        ? 'bg-green-100 text-green-700'
                        : isCurrent
                        ? 'bg-cgp-red text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {idx < 2 && (
                    <ArrowRight className="w-4 h-4 mx-2 text-slate-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Form Step */}
          {(step === 'form' || step === 'error') && (
            <div className="space-y-6">
              {/* Resume Source */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Resume Source
                </label>

                {/* Toggle for existing resume */}
                {candidate?.resume_url && (
                  <div className="mb-4">
                    <button
                      onClick={() => {
                        setUseExistingResume(true);
                        setFile(null);
                      }}
                      className={`w-full p-4 rounded-lg border-2 transition-colors text-left ${
                        useExistingResume
                          ? 'border-cgp-red bg-cgp-red/5'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          useExistingResume ? 'border-cgp-red' : 'border-slate-300'
                        }`}>
                          {useExistingResume && <div className="w-2.5 h-2.5 rounded-full bg-cgp-red" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">Use existing resume</p>
                          <p className="text-sm text-slate-500 truncate max-w-md">{candidate.resume_url}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}

                {/* File Upload */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    file && !useExistingResume
                      ? 'border-cgp-red bg-cgp-red/5'
                      : 'border-slate-300 hover:border-slate-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {file && !useExistingResume ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="w-8 h-8 text-cgp-red" />
                      <div className="text-left">
                        <p className="text-slate-800 font-medium">{file.name}</p>
                        <p className="text-sm text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-slate-600 font-medium">
                        {candidate?.resume_url ? 'Or upload a different resume' : 'Drop a resume here or click to browse'}
                      </p>
                      <p className="text-sm text-slate-400 mt-1">
                        Supports PDF and Word documents
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Candidate Details Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Candidate Name <span className="text-cgp-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. John Tan Wei Ming"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Nationality <span className="text-cgp-red">*</span>
                  </label>
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select nationality</option>
                    {NATIONALITIES.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Gender <span className="text-cgp-red">*</span>
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Expected Salary (SGD) <span className="text-cgp-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 4,000 or 4,000 - 5,000"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Notice Period <span className="text-cgp-red">*</span>
                  </label>
                  <select
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select notice period</option>
                    {NOTICE_PERIODS.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Prepared By
                  </label>
                  <input
                    type="text"
                    value={preparedBy}
                    onChange={(e) => setPreparedBy(e.target.value)}
                    placeholder="e.g. Go Ai Wei (defaults to CGP Personnel)"
                    className="input w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Processing Step */}
          {(step === 'extracting' || step === 'parsing' || step === 'generating') && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-cgp-red rounded-full animate-spin mb-6" />
              <p className="text-lg font-medium text-slate-700">
                {step === 'extracting' && 'Extracting text from resume...'}
                {step === 'parsing' && 'AI is analyzing the resume...'}
                {step === 'generating' && 'Generating CGP document...'}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                This may take a few seconds
              </p>
            </div>
          )}

          {/* Complete Step - Preview */}
          {step === 'complete' && parsedResume && (
            <div className="space-y-6">
              {/* Success Message */}
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-700">Resume Converted Successfully!</p>
                  <p className="text-sm text-green-600">Your CGP-formatted resume is ready to download</p>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-white">
                  <h3 className="font-semibold text-slate-800">Preview</h3>
                </div>
                <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
                  {/* Candidate Info */}
                  <div>
                    <h4 className="text-sm font-semibold text-cgp-red flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4" />
                      Candidate Information
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-slate-500">Name:</span> {parsedResume.candidateName}</div>
                      <div><span className="text-slate-500">Nationality:</span> {parsedResume.nationality}</div>
                      <div><span className="text-slate-500">Gender:</span> {parsedResume.gender}</div>
                      <div><span className="text-slate-500">Expected Salary:</span> {parsedResume.expectedSalary}</div>
                      <div><span className="text-slate-500">Notice Period:</span> {parsedResume.noticePeriod}</div>
                    </div>
                  </div>

                  {/* Education */}
                  <div>
                    <h4 className="text-sm font-semibold text-cgp-red flex items-center gap-2 mb-2">
                      <GraduationCap className="w-4 h-4" />
                      Education
                    </h4>
                    <div className="space-y-2 text-sm">
                      {parsedResume.education.map((edu, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-slate-200">
                          <p className="font-medium">{edu.year} - {edu.qualification}</p>
                          <p className="text-slate-500 italic">{edu.institution}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Work Experience */}
                  <div>
                    <h4 className="text-sm font-semibold text-cgp-red flex items-center gap-2 mb-2">
                      <Briefcase className="w-4 h-4" />
                      Work Experience
                    </h4>
                    <div className="space-y-3 text-sm">
                      {parsedResume.workExperience.map((job, idx) => (
                        <div key={idx} className="pl-4 border-l-2 border-slate-200">
                          <p className="font-medium">{job.title}</p>
                          <p className="text-slate-600">{job.period}</p>
                          <p className="text-slate-500 italic">{job.company}</p>
                          <ul className="mt-1 list-disc list-inside text-slate-600">
                            {job.responsibilities.slice(0, 3).map((resp, ridx) => (
                              <li key={ridx}>{resp}</li>
                            ))}
                            {job.responsibilities.length > 3 && (
                              <li className="text-slate-400">+{job.responsibilities.length - 3} more...</li>
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Languages */}
                  <div>
                    <h4 className="text-sm font-semibold text-cgp-red flex items-center gap-2 mb-2">
                      <Languages className="w-4 h-4" />
                      Languages
                    </h4>
                    <p className="text-sm text-slate-600">{parsedResume.languages.join(', ')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button onClick={handleClose} className="btn-secondary">
            {step === 'complete' ? 'Close' : 'Cancel'}
          </button>

          {(step === 'form' || step === 'error') && (
            <button
              onClick={handleConvert}
              className="btn-primary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Convert to CGP Format
            </button>
          )}

          {step === 'complete' && (
            <>
              <button
                onClick={handleStartOver}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Convert Another
              </button>
              <button
                onClick={handleDownload}
                className="btn-primary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download .docx
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
