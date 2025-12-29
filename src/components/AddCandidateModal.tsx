import { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
  Star,
} from 'lucide-react';
import { useCreateCandidate, useCreateActivity } from '../hooks/useData';
import {
  performFullScreening,
  fileToBase64,
  uploadResumeToStorage,
  type ScreeningResult,
} from '../services/aiScreening';
import type { CandidateSource, CandidateStatus, AICategory, CitizenshipStatus } from '../types';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOURCES: CandidateSource[] = ['FastJobs', 'Seek', 'Indeed', 'LinkedIn', 'Direct', 'Referral', 'Email', 'WhatsApp', 'Telegram', 'Others'];

type ScreeningStep = 'idle' | 'uploading' | 'fetching_roles' | 'screening' | 'complete' | 'error';

export default function AddCandidateModal({ isOpen, onClose }: AddCandidateModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<CandidateSource>('FastJobs');
  const [emailSubject, setEmailSubject] = useState('');
  const [step, setStep] = useState<ScreeningStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createCandidate = useCreateCandidate();
  const createActivity = useCreateActivity();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
      setStep('idle');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!validTypes.includes(droppedFile.type)) {
        setError('Please upload a PDF or Word document (.pdf, .doc, .docx)');
        return;
      }
      setFile(droppedFile);
      setError(null);
      setResult(null);
      setStep('idle');
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleScreen = async () => {
    if (!file) {
      setError('Please upload a resume (PDF or Word document)');
      return;
    }

    if (!emailSubject.trim()) {
      setError('Please enter the job role (e.g., "Senior Software Engineer")');
      return;
    }

    setError(null);
    setStep('uploading');

    try {
      // Convert file to base64
      const fileBase64 = await fileToBase64(file);
      setStep('fetching_roles');

      // Perform full screening
      setStep('screening');
      const screeningResult = await performFullScreening({
        pdfBase64: fileBase64,
        emailSubject,
        source,
        mediaType: file.type,
      });

      setResult(screeningResult);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during screening');
      setStep('error');
    }
  };

  const handleAddCandidate = async () => {
    if (!result || !file) return;

    // Determine the status based on recommendation
    let status: CandidateStatus;
    if (result.recommendation === 'Rejected') {
      status = 'rejected_ai';
    } else {
      status = 'ai_screened';
    }

    try {
      // Upload resume to storage
      const resumeUrl = await uploadResumeToStorage(file, result.candidate_name);

      const newCandidate = await createCandidate.mutateAsync({
        date_received: new Date().toISOString(),
        full_name: result.candidate_name,
        email: result.candidate_email,
        phone: result.candidate_phone,
        source: source,
        applied_role: result.job_matched,
        ai_score: result.score,
        ai_category: result.recommendation as AICategory,
        citizenship_status: result.citizenship_status as CitizenshipStatus,
        ai_summary: result.summary,
        ai_reasoning: '',
        resume_url: resumeUrl || '',
        current_status: status,
        assigned_recruiter: null,
        matched_roles: [result.job_matched],
        client_submitted_to: null,
        submission_date: null,
        interview_date: null,
        interview_outcome: null,
        offer_date: null,
        offer_status: null,
        start_date: null,
        contract_end_date: null,
        hourly_rate: null,
        bill_rate: null,
        placement_status: null,
        notes: null,
        last_contact_date: null,
        next_action: result.recommendation === 'Rejected' ? null : 'Review application',
        next_action_date: result.recommendation === 'Rejected' ? null : new Date().toISOString().split('T')[0],
      });

      // Create an activity for the AI screening
      await createActivity.mutateAsync({
        candidate_id: newCandidate.id,
        candidate_name: result.candidate_name,
        activity_date: new Date().toISOString(),
        activity_type: 'AI Screening',
        direction: 'Internal',
        channel: 'System',
        subject: `Application Received via ${source}`,
        details: `New application received. AI screening completed with score ${result.score}/10. ${result.summary}`,
        related_job: result.job_matched,
        related_client: null,
        outcome: result.recommendation === 'Rejected' ? 'Rejected' : 'Pending Review',
        follow_up_required: result.recommendation !== 'Rejected',
        follow_up_date: result.recommendation === 'Rejected' ? null : new Date().toISOString().split('T')[0],
        follow_up_action: result.recommendation === 'Rejected' ? null : 'Review application',
        logged_by: 'System',
      });

      // Reset and close
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add candidate');
    }
  };

  const handleClose = () => {
    setFile(null);
    setSource('FastJobs');
    setEmailSubject('');
    setStep('idle');
    setError(null);
    setResult(null);
    onClose();
  };

  const getScoreColor = (score: number): string => {
    if (score >= 8) return 'text-emerald-600';
    if (score >= 6) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRecommendationBadge = (recommendation: string) => {
    if (recommendation === 'Top Candidate') {
      return 'badge-success';
    } else if (recommendation === 'Review') {
      return 'badge-warning';
    }
    return 'badge-error';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-800">Add Candidate</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Source Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Source
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as CandidateSource)}
              className="input w-full"
              disabled={step !== 'idle' && step !== 'error'}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Applying Job */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Applying Job
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="e.g., Application for Senior Software Engineer"
              className="input w-full"
              disabled={step !== 'idle' && step !== 'error'}
            />
            <p className="text-xs text-slate-400 mt-1">
              This helps the AI match the candidate to the right job role
            </p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              Resume (PDF or Word)
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file
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
                disabled={step !== 'idle' && step !== 'error'}
              />
              {file ? (
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
                  <p className="text-slate-500">
                    Drop a resume here or click to browse (.pdf, .doc, .docx)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Progress Indicator */}
          {step !== 'idle' && step !== 'error' && step !== 'complete' && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-100">
              <Loader2 className="w-5 h-5 text-cgp-red animate-spin" />
              <p className="text-slate-600">
                {step === 'uploading' && 'Reading PDF...'}
                {step === 'fetching_roles' && 'Fetching job roles...'}
                {step === 'screening' && 'AI is analyzing the resume...'}
              </p>
            </div>
          )}

          {/* Screening Result */}
          {step === 'complete' && result && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Screening Complete</span>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-4 border border-slate-100">
                {/* Candidate Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Name</p>
                    <p className="text-slate-800 font-medium">{result.candidate_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Score</p>
                    <div className={`flex items-center gap-1 ${getScoreColor(result.score)}`}>
                      <Star className="w-4 h-4" />
                      <span className="font-bold text-lg">{result.score}/10</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Email</p>
                    <p className="text-slate-700">{result.candidate_email || 'Not found'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Phone</p>
                    <p className="text-slate-700">{result.candidate_phone || 'Not found'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Matched Role</p>
                    <p className="text-slate-700">{result.job_matched}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Citizenship</p>
                    <p className="text-slate-700">{result.citizenship_status}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Recommendation</p>
                  <span className={`badge ${getRecommendationBadge(result.recommendation)}`}>
                    {result.recommendation}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-slate-400 uppercase mb-1">Summary</p>
                  <p className="text-slate-600 text-sm">{result.summary}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={handleClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          {step === 'complete' && result ? (
            <button
              onClick={handleAddCandidate}
              className="btn-primary"
              disabled={createCandidate.isPending}
            >
              {createCandidate.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add Candidate'
              )}
            </button>
          ) : (
            <button
              onClick={handleScreen}
              className="btn-primary"
              disabled={!file || !emailSubject.trim() || (step !== 'idle' && step !== 'error')}
            >
              {step !== 'idle' && step !== 'error' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Screening...
                </>
              ) : (
                'Screen Resume'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
