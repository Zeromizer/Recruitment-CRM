import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Star,
  Calendar,
  Briefcase,
  FileText,
  MessageSquare,
  Clock,
  ChevronDown,
  ExternalLink,
  Send,
  PhoneCall,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  FileOutput,
  Pencil,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  useCandidate,
  useCandidates,
  useCandidateActivities,
  useCandidateInterviews,
  useUpdateCandidateStatus,
  useUpdateCandidate,
  useCreateActivity,
} from '../hooks/useData';
import type { CandidateStatus, Activity, CallOutcome } from '../types';
import { STATUS_LABELS, CALL_OUTCOME_COLORS } from '../types';
import CallOutcomeModal from '../components/CallOutcomeModal';
import ResumeConverterModal from '../components/ResumeConverterModal';

function getStatusBadgeClass(status: CandidateStatus): string {
  const statusColors: Record<string, string> = {
    new_application: 'badge-info',
    ai_screened: 'badge-info',
    human_reviewed: 'badge-neutral',
    shortlisted: 'badge-success',
    submitted_to_client: 'badge-warning',
    interview_scheduled: 'badge-warning',
    interview_completed: 'badge-neutral',
    offer_extended: 'badge-success',
    offer_accepted: 'badge-success',
    placement_started: 'badge-success',
    placement_completed: 'badge-success',
    on_hold: 'badge-neutral',
    withdrawn: 'badge-neutral',
    rejected_ai: 'badge-error',
    rejected_human: 'badge-error',
    rejected_client: 'badge-error',
    blacklisted: 'badge-error',
  };
  return statusColors[status] || 'badge-neutral';
}

function getCitizenshipBadge(status: string | null) {
  if (!status) return null;
  const colors: Record<string, string> = {
    SC: 'badge-success',
    PR: 'badge-success',
    'Not Identified': 'badge-warning',
    Foreign: 'badge-error',
  };
  return <span className={`badge ${colors[status] || 'badge-neutral'}`}>{status}</span>;
}

function getAICategoryBadge(category: string | null) {
  if (!category) return null;
  const colors: Record<string, string> = {
    'Top Candidate': 'badge-success',
    Review: 'badge-warning',
    Rejected: 'badge-error',
  };
  return <span className={`badge ${colors[category] || 'badge-neutral'}`}>{category}</span>;
}

function ActivityItem({ activity, onLogOutcome }: { activity: Activity; onLogOutcome?: (activity: Activity) => void }) {
  const iconMap: Record<string, React.ElementType> = {
    'Phone Screen': PhoneCall,
    'Phone Call': PhoneCall,
    'Phone Interview': PhoneCall,
    'Email Sent': Mail,
    'WhatsApp Message': MessageSquare,
    'Interview Scheduled': Calendar,
    'Interview Completed': Calendar,
    'Submission': Send,
    'Offer Extended': Briefcase,
    'AI Screening': Star,
    'Onboarding': Briefcase,
    'Status Change': ArrowRight,
  };
  const Icon = iconMap[activity.activity_type] || MessageSquare;

  // Check if this is a call/email activity that needs outcome logging
  const needsOutcome = activity.follow_up_required &&
    activity.follow_up_action === 'Log outcome' &&
    !activity.outcome &&
    ['Phone Call', 'Phone Screen', 'Email Sent'].includes(activity.activity_type);

  // Get outcome badge styling
  const getOutcomeBadge = (outcome: string) => {
    const outcomeKey = outcome as CallOutcome;
    const colors = CALL_OUTCOME_COLORS[outcomeKey];
    if (colors) {
      return `inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`;
    }
    return 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600';
  };

  return (
    <div className={`flex gap-4 p-4 rounded-lg border ${needsOutcome ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${needsOutcome ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-slate-200'}`}>
        <Icon className={`w-5 h-5 ${needsOutcome ? 'text-amber-600' : 'text-slate-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-slate-800">{activity.activity_type}</p>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {format(parseISO(activity.activity_date), 'MMM d, h:mm a')}
          </span>
        </div>
        {activity.subject && (
          <p className="text-sm text-slate-600 mt-1">{activity.subject}</p>
        )}
        {activity.details && (
          <p className="text-sm text-slate-500 mt-1">{activity.details}</p>
        )}
        {activity.outcome && (
          <div className="mt-2">
            <span className={getOutcomeBadge(activity.outcome)}>
              {activity.outcome === 'Shortlisted' && <CheckCircle className="w-3 h-3" />}
              {activity.outcome === 'Rejected' && <XCircle className="w-3 h-3" />}
              {activity.outcome}
            </span>
          </div>
        )}
        {needsOutcome && onLogOutcome && (
          <button
            onClick={() => onLogOutcome(activity)}
            className="mt-2 text-sm text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Log outcome
          </button>
        )}
        {activity.follow_up_required && activity.follow_up_action && activity.follow_up_action !== 'Log outcome' && (
          <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Follow-up: {activity.follow_up_action}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: candidate, isLoading } = useCandidate(id!);
  const { data: allCandidates = [] } = useCandidates();
  const { data: activities = [] } = useCandidateActivities(id!);
  const { data: interviews = [] } = useCandidateInterviews(id!);
  const updateStatus = useUpdateCandidateStatus();
  const updateCandidate = useUpdateCandidate();
  const createActivity = useCreateActivity();

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [showCallOutcomeModal, setShowCallOutcomeModal] = useState(false);
  const [showResumeConverterModal, setShowResumeConverterModal] = useState(false);
  const [pendingActivityForOutcome, setPendingActivityForOutcome] = useState<Activity | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [interviewForm, setInterviewForm] = useState({
    date: '',
    time: '',
    type: 'Video',
    round: '1st',
    company: '',
    location: '',
    interviewer: '',
    notes: '',
  });

  // Get unique roles from all candidates for the dropdown
  const availableRoles = useMemo(() => {
    const roleSet = new Set(allCandidates.map(c => c.applied_role).filter(Boolean));
    return Array.from(roleSet).sort() as string[];
  }, [allCandidates]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cgp-red"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Candidate not found</p>
        <Link to="/candidates" className="text-cgp-red hover:text-cgp-red-dark mt-2 inline-block">
          Back to candidates
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (newStatus: CandidateStatus) => {
    try {
      await updateStatus.mutateAsync({ id: candidate.id, status: newStatus });
      setShowStatusDropdown(false);

      // Log activity
      await createActivity.mutateAsync({
        candidate_id: candidate.id,
        candidate_name: candidate.full_name,
        activity_date: new Date().toISOString(),
        activity_type: 'Status Change',
        direction: 'Internal',
        channel: 'System',
        subject: `Status changed to ${STATUS_LABELS[newStatus]}`,
        details: `Candidate status updated from ${STATUS_LABELS[candidate.current_status]} to ${STATUS_LABELS[newStatus]}`,
        related_job: candidate.applied_role,
        related_client: candidate.client_submitted_to,
        outcome: null,
        follow_up_required: false,
        follow_up_date: null,
        follow_up_action: null,
        logged_by: 'Shawn',
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateCandidate.mutateAsync({
        id: candidate.id,
        updates: { notes },
      });
      setEditingNotes(false);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!newRole.trim() || newRole === candidate.applied_role) {
      setShowRoleDropdown(false);
      setCustomRole('');
      return;
    }

    try {
      const oldRole = candidate.applied_role;
      await updateCandidate.mutateAsync({
        id: candidate.id,
        updates: { applied_role: newRole.trim() },
      });

      // Log activity for role change
      await createActivity.mutateAsync({
        candidate_id: candidate.id,
        candidate_name: candidate.full_name,
        activity_date: new Date().toISOString(),
        activity_type: 'Status Change',
        direction: 'Internal',
        channel: 'System',
        subject: `Role changed to ${newRole.trim()}`,
        details: `Applied role updated from "${oldRole || 'None'}" to "${newRole.trim()}"`,
        related_job: newRole.trim(),
        related_client: candidate.client_submitted_to,
        outcome: null,
        follow_up_required: false,
        follow_up_date: null,
        follow_up_action: null,
        logged_by: 'Shawn',
      });

      setShowRoleDropdown(false);
      setCustomRole('');
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleQuickAction = async (actionType: string) => {
    const newActivity = await createActivity.mutateAsync({
      candidate_id: candidate.id,
      candidate_name: candidate.full_name,
      activity_date: new Date().toISOString(),
      activity_type: actionType,
      direction: 'Outbound',
      channel: actionType === 'Phone Call' ? 'Phone' : 'Email',
      subject: `${actionType} with ${candidate.full_name}`,
      details: null,
      related_job: candidate.applied_role,
      related_client: candidate.client_submitted_to,
      outcome: null,
      follow_up_required: true,
      follow_up_date: null,
      follow_up_action: 'Log outcome',
      logged_by: 'Shawn',
    });

    // Show outcome modal immediately after logging a call
    if (actionType === 'Phone Call' && newActivity) {
      setPendingActivityForOutcome(newActivity as Activity);
      setShowCallOutcomeModal(true);
    }
  };

  // Handle opening outcome modal for an existing activity
  const handleLogOutcome = (activity: Activity) => {
    setPendingActivityForOutcome(activity);
    setShowCallOutcomeModal(true);
  };

  // Handle submitting call outcome
  const handleCallOutcomeSubmit = async (
    outcome: CallOutcome,
    callNotes: string,
    followUpDate: string | null,
    shouldUpdateStatus: boolean,
    newStatus: string | null
  ) => {
    // Update the activity with the outcome
    if (pendingActivityForOutcome) {
      await createActivity.mutateAsync({
        candidate_id: candidate.id,
        candidate_name: candidate.full_name,
        activity_date: new Date().toISOString(),
        activity_type: 'Call Outcome Logged',
        direction: 'Internal',
        channel: 'System',
        subject: `Call outcome: ${outcome}`,
        details: callNotes || `Outcome logged for call with ${candidate.full_name}`,
        related_job: candidate.applied_role,
        related_client: candidate.client_submitted_to,
        outcome: outcome,
        follow_up_required: followUpDate ? true : false,
        follow_up_date: followUpDate,
        follow_up_action: followUpDate ? 'Follow up call' : null,
        logged_by: 'Shawn',
      });
    }

    // Update candidate status if needed
    if (shouldUpdateStatus && newStatus) {
      await updateStatus.mutateAsync({ id: candidate.id, status: newStatus as CandidateStatus });

      // Also update next_action based on the outcome
      let nextAction = null;
      let nextActionDate = null;

      if (outcome === 'Shortlisted') {
        nextAction = 'Prepare resume and submit to client';
      } else if (followUpDate) {
        nextAction = 'Follow up with candidate';
        nextActionDate = followUpDate;
      }

      if (nextAction) {
        await updateCandidate.mutateAsync({
          id: candidate.id,
          updates: {
            next_action: nextAction,
            next_action_date: nextActionDate,
            last_contact_date: new Date().toISOString().split('T')[0],
          },
        });
      }
    } else {
      // Just update last contact date
      await updateCandidate.mutateAsync({
        id: candidate.id,
        updates: {
          last_contact_date: new Date().toISOString().split('T')[0],
          ...(followUpDate && {
            next_action: 'Follow up with candidate',
            next_action_date: followUpDate,
          }),
        },
      });
    }

    setPendingActivityForOutcome(null);
  };

  const handleScheduleInterview = async () => {
    if (!interviewForm.date || !interviewForm.time) {
      alert('Please select a date and time');
      return;
    }

    const interviewDateTime = new Date(`${interviewForm.date}T${interviewForm.time}`);

    await createActivity.mutateAsync({
      candidate_id: candidate.id,
      candidate_name: candidate.full_name,
      activity_date: new Date().toISOString(),
      activity_type: 'Interview Scheduled',
      direction: 'Outbound',
      channel: 'System',
      subject: `Interview Scheduled with ${candidate.full_name}`,
      details: `${interviewForm.type} interview (${interviewForm.round} Round) scheduled for ${format(interviewDateTime, 'MMM d, yyyy')} at ${interviewForm.time}${interviewForm.company ? ` with ${interviewForm.company}` : ''}${interviewForm.location ? ` at ${interviewForm.location}` : ''}`,
      related_job: candidate.applied_role,
      related_client: interviewForm.company || candidate.client_submitted_to,
      outcome: null,
      follow_up_required: true,
      follow_up_date: interviewForm.date,
      follow_up_action: 'Log outcome',
      logged_by: 'Shawn',
    });

    // Update candidate status to interview_scheduled
    await updateStatus.mutateAsync({ id: candidate.id, status: 'interview_scheduled' });

    // Reset form and close modal
    setInterviewForm({
      date: '',
      time: '',
      type: 'Video',
      round: '1st',
      company: '',
      location: '',
      interviewer: '',
      notes: '',
    });
    setShowInterviewModal(false);
  };

  return (
    <div className="flex gap-6">
      {/* Left Side - Candidate Info */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Profile Header with Inline Details */}
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-cgp-red rounded-full flex items-center justify-center shadow-md">
                <span className="text-xl font-medium text-white">
                  {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{candidate.full_name}</h1>
                {/* Editable Role */}
                <div className="relative mt-1">
                  <button
                    onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors group"
                  >
                    <span>{candidate.applied_role || 'No role assigned'}</span>
                    <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  {showRoleDropdown && (
                    <div className="absolute left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-20">
                      {/* Custom role input */}
                      <div className="p-3 border-b border-slate-100">
                        <label className="block text-xs text-slate-500 mb-1">Enter new role</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            placeholder="e.g., Senior Developer"
                            className="input flex-1 text-sm min-w-0"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && customRole.trim()) {
                                handleRoleChange(customRole);
                              }
                            }}
                          />
                          <button
                            onClick={() => handleRoleChange(customRole)}
                            disabled={!customRole.trim()}
                            className="bg-cgp-red text-white text-sm px-3 py-2 rounded-lg font-medium hover:bg-cgp-red-dark transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex-shrink-0"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                      {/* Existing roles */}
                      {availableRoles.length > 0 && (
                        <div className="max-h-48 overflow-y-auto">
                          <p className="text-xs text-slate-400 px-3 pt-2 pb-1">Or select existing role</p>
                          {availableRoles
                            .filter(role => role !== candidate.applied_role)
                            .map(role => (
                              <button
                                key={role}
                                onClick={() => handleRoleChange(role)}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                {role}
                              </button>
                            ))}
                        </div>
                      )}
                      {/* Cancel button */}
                      <div className="p-2 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setShowRoleDropdown(false);
                            setCustomRole('');
                          }}
                          className="w-full text-center text-sm text-slate-500 hover:text-slate-700 py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  {getCitizenshipBadge(candidate.citizenship_status)}
                  {getAICategoryBadge(candidate.ai_category)}
                </div>
              </div>
            </div>

            {/* Status Dropdown & Date Received */}
            <div className="flex flex-col items-end gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`badge ${getStatusBadgeClass(candidate.current_status)} flex items-center gap-1 cursor-pointer hover:opacity-80`}
                >
                  {STATUS_LABELS[candidate.current_status]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status as CandidateStatus)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${
                          status === candidate.current_status ? 'text-cgp-red font-medium' : 'text-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Date Received</p>
                <p className="text-sm text-slate-600">{format(parseISO(candidate.date_received), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mt-4 flex flex-wrap gap-4">
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="flex items-center gap-2 text-slate-600 hover:text-cgp-red transition-colors"
              >
                <Mail className="w-4 h-4" />
                {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="flex items-center gap-2 text-slate-600 hover:text-cgp-red transition-colors"
              >
                <Phone className="w-4 h-4" />
                {candidate.phone}
              </a>
            )}
            {candidate.source && (
              <span className="flex items-center gap-2 text-slate-500">
                <MapPin className="w-4 h-4" />
                Source: {candidate.source}
              </span>
            )}
          </div>

          {/* Inline Details */}
          <div className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {candidate.assigned_recruiter && (
                <div>
                  <p className="text-sm text-slate-400">Assigned To</p>
                  <p className="text-slate-700">{candidate.assigned_recruiter}</p>
                </div>
              )}
              {candidate.client_submitted_to && (
                <div>
                  <p className="text-sm text-slate-400">Submitted To</p>
                  <p className="text-slate-700">{candidate.client_submitted_to}</p>
                </div>
              )}
              {candidate.submission_date && (
                <div>
                  <p className="text-sm text-slate-400">Submission Date</p>
                  <p className="text-slate-700">{format(parseISO(candidate.submission_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {candidate.interview_date && (
                <div>
                  <p className="text-sm text-slate-400">Interview Date</p>
                  <p className="text-slate-700">
                    {format(parseISO(candidate.interview_date), 'MMM d, yyyy')}
                    {candidate.interview_outcome && ` (${candidate.interview_outcome})`}
                  </p>
                </div>
              )}
              {candidate.offer_date && (
                <div>
                  <p className="text-sm text-slate-400">Offer Date</p>
                  <p className="text-slate-700">
                    {format(parseISO(candidate.offer_date), 'MMM d, yyyy')}
                    {candidate.offer_status && ` (${candidate.offer_status})`}
                  </p>
                </div>
              )}
              {candidate.start_date && (
                <div>
                  <p className="text-sm text-slate-400">Start Date</p>
                  <p className="text-slate-700">{format(parseISO(candidate.start_date), 'MMM d, yyyy')}</p>
                </div>
              )}
              {(candidate.hourly_rate || candidate.bill_rate) && (
                <div>
                  <p className="text-sm text-slate-400">Rates</p>
                  <p className="text-slate-700">
                    {candidate.hourly_rate && `$${candidate.hourly_rate}/hr`}
                    {candidate.hourly_rate && candidate.bill_rate && ' / '}
                    {candidate.bill_rate && `$${candidate.bill_rate} bill`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Workflow Progress Indicator */}
          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-700">Workflow Progress</h3>
              <span className={`text-xs px-2 py-1 rounded-full ${
                ['new_application', 'ai_screened', 'human_reviewed'].includes(candidate.current_status)
                  ? 'bg-blue-100 text-blue-700'
                  : ['shortlisted', 'submitted_to_client'].includes(candidate.current_status)
                  ? 'bg-yellow-100 text-yellow-700'
                  : ['interview_scheduled', 'interview_completed'].includes(candidate.current_status)
                  ? 'bg-purple-100 text-purple-700'
                  : ['offer_extended', 'offer_accepted', 'placement_started'].includes(candidate.current_status)
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {STATUS_LABELS[candidate.current_status]}
              </span>
            </div>
            {/* Progress Steps */}
            <div className="flex items-center gap-1 mb-4">
              {['Review', 'Call', 'Shortlist', 'Submit', 'Interview', 'Offer', 'Placed'].map((step, idx) => {
                const statusMap: Record<string, number> = {
                  'new_application': 0, 'ai_screened': 0, 'human_reviewed': 1,
                  'shortlisted': 2, 'submitted_to_client': 3,
                  'interview_scheduled': 4, 'interview_completed': 4,
                  'offer_extended': 5, 'offer_accepted': 5,
                  'placement_started': 6, 'placement_completed': 6,
                };
                const currentStep = statusMap[candidate.current_status] ?? -1;
                const isCompleted = idx < currentStep;
                const isCurrent = idx === currentStep;
                return (
                  <div key={step} className="flex-1">
                    <div className={`h-2 rounded-full ${
                      isCompleted ? 'bg-green-500' : isCurrent ? 'bg-cgp-red' : 'bg-slate-200'
                    }`} />
                    <p className={`text-xs mt-1 text-center ${
                      isCurrent ? 'text-cgp-red font-medium' : isCompleted ? 'text-green-600' : 'text-slate-400'
                    }`}>{step}</p>
                  </div>
                );
              })}
            </div>
            {/* Recommended Next Action */}
            <div className={`p-3 rounded-lg border ${
              ['new_application', 'ai_screened', 'human_reviewed'].includes(candidate.current_status)
                ? 'bg-blue-50 border-blue-200'
                : candidate.current_status === 'shortlisted'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <p className="text-xs text-slate-500 mb-1">Recommended Next Action</p>
              <p className={`text-sm font-medium ${
                ['new_application', 'ai_screened', 'human_reviewed'].includes(candidate.current_status)
                  ? 'text-blue-700'
                  : candidate.current_status === 'shortlisted'
                  ? 'text-yellow-700'
                  : 'text-green-700'
              }`}>
                {['new_application', 'ai_screened'].includes(candidate.current_status)
                  ? 'Review candidate and call to screen'
                  : candidate.current_status === 'human_reviewed'
                  ? 'Call candidate to assess fit and shortlist'
                  : candidate.current_status === 'shortlisted'
                  ? 'Prepare resume and submit to client'
                  : candidate.current_status === 'submitted_to_client'
                  ? 'Follow up with client for feedback'
                  : candidate.current_status === 'interview_scheduled'
                  ? 'Prepare candidate for interview'
                  : candidate.current_status === 'interview_completed'
                  ? 'Get feedback and proceed to offer'
                  : candidate.current_status === 'offer_extended'
                  ? 'Follow up on offer decision'
                  : candidate.current_status === 'offer_accepted'
                  ? 'Complete onboarding'
                  : 'Monitor placement progress'}
              </p>
            </div>
          </div>

          {/* Next Action Banner */}
          {candidate.next_action && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-700 font-medium">Scheduled Action</p>
                  <p className="text-slate-700">{candidate.next_action}</p>
                  {candidate.next_action_date && (
                    <p className="text-sm text-amber-600 mt-1">
                      Due: {format(parseISO(candidate.next_action_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions - Context Aware */}
          <div className="mt-6">
            <div className="flex flex-wrap gap-3">
              {/* Primary CTA based on status */}
              {['new_application', 'ai_screened', 'human_reviewed'].includes(candidate.current_status) && (
                <button
                  onClick={() => handleQuickAction('Phone Call')}
                  className="btn-primary flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  Call & Screen
                </button>
              )}
              {candidate.current_status === 'shortlisted' && (
                <button
                  onClick={() => handleStatusChange('submitted_to_client')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Submit to Client
                </button>
              )}
              {candidate.current_status === 'submitted_to_client' && (
                <button
                  onClick={() => setShowInterviewModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Interview
                </button>
              )}

              {/* Secondary Actions */}
              <button
                onClick={() => handleQuickAction('Phone Call')}
                className="btn-secondary flex items-center gap-2"
              >
                <PhoneCall className="w-4 h-4" />
                Log Call
              </button>
              <button
                onClick={() => handleQuickAction('Email Sent')}
                className="btn-secondary flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Log Email
              </button>
              {!['new_application', 'ai_screened', 'human_reviewed', 'shortlisted'].includes(candidate.current_status) && (
                <button
                  onClick={() => setShowInterviewModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  Schedule Interview
                </button>
              )}

              {/* Quick Status Actions for early stages */}
              {['new_application', 'ai_screened', 'human_reviewed'].includes(candidate.current_status) && (
                <>
                  <button
                    onClick={() => handleStatusChange('shortlisted')}
                    className="btn-secondary flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Shortlist
                  </button>
                  <button
                    onClick={() => handleStatusChange('rejected_human')}
                    className="btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Assessment */}
        {candidate.ai_score && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                AI Assessment
              </h2>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-slate-500">Score</span>
                  <span className="text-lg font-bold text-slate-800">{candidate.ai_score}</span>
                  <span className="text-sm text-slate-400">/10</span>
                </div>
                {candidate.ai_category && (
                  <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    candidate.ai_category === 'Top Candidate' ? 'bg-green-100 text-green-700' :
                    candidate.ai_category === 'Review' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {candidate.ai_category}
                  </span>
                )}
              </div>
            </div>
            {candidate.ai_summary && (
              <div className="mb-3">
                <p className="text-sm text-slate-500 mb-1">Summary</p>
                <p className="text-slate-700 text-sm">{candidate.ai_summary}</p>
              </div>
            )}
            {candidate.ai_reasoning && (
              <div>
                <p className="text-sm text-slate-500 mb-1">Reasoning</p>
                <p className="text-slate-700 text-sm">{candidate.ai_reasoning}</p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              Notes
            </h2>
            {!editingNotes && (
              <button
                onClick={() => {
                  setNotes(candidate.notes || '');
                  setEditingNotes(true);
                }}
                className="text-sm text-cgp-red hover:text-cgp-red-dark"
              >
                {candidate.notes ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-3">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="input w-full resize-none"
                placeholder="Add notes about this candidate..."
              />
              <div className="flex gap-2">
                <button onClick={handleSaveNotes} className="btn-primary text-sm">
                  Save
                </button>
                <button
                  onClick={() => setEditingNotes(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-600">
              {candidate.notes || 'No notes yet'}
            </p>
          )}
        </div>

        {/* Upcoming Interviews */}
        {interviews.filter(i => i.status === 'Scheduled').length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Upcoming Interviews</h2>
            <div className="space-y-3">
              {interviews
                .filter(i => i.status === 'Scheduled')
                .map(interview => (
                  <div
                    key={interview.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <p className="text-slate-800 font-medium">{interview.client_company}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {interview.interview_date && format(parseISO(interview.interview_date), 'MMM d')}
                      {interview.interview_time && ` at ${interview.interview_time}`}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {interview.interview_type} • {interview.interview_round} Round
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Activity Timeline */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Activity Timeline
            </h2>
            {activities.filter(a => a.follow_up_required && a.follow_up_action === 'Log outcome' && !a.outcome).length > 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                {activities.filter(a => a.follow_up_required && a.follow_up_action === 'Log outcome' && !a.outcome).length} pending outcome(s)
              </span>
            )}
          </div>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map(activity => (
                <ActivityItem key={activity.id} activity={activity} onLogOutcome={handleLogOutcome} />
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No activities logged yet</p>
          )}
        </div>

        {/* Schedule Interview Modal */}
        {showInterviewModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Schedule Interview</h2>
              <button
                onClick={() => setShowInterviewModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Date and Time - Required */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">
                    Date <span className="text-cgp-red">*</span>
                  </label>
                  <input
                    type="date"
                    value={interviewForm.date}
                    onChange={(e) => setInterviewForm({ ...interviewForm, date: e.target.value })}
                    className="input w-full"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">
                    Time <span className="text-cgp-red">*</span>
                  </label>
                  <input
                    type="time"
                    value={interviewForm.time}
                    onChange={(e) => setInterviewForm({ ...interviewForm, time: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Interview Type and Round */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Interview Type</label>
                  <select
                    value={interviewForm.type}
                    onChange={(e) => setInterviewForm({ ...interviewForm, type: e.target.value })}
                    className="input w-full"
                  >
                    <option value="Video">Video Call</option>
                    <option value="Phone">Phone</option>
                    <option value="In-Person">In-Person</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-500 mb-1">Round</label>
                  <select
                    value={interviewForm.round}
                    onChange={(e) => setInterviewForm({ ...interviewForm, round: e.target.value })}
                    className="input w-full"
                  >
                    <option value="1st">1st Round</option>
                    <option value="2nd">2nd Round</option>
                    <option value="3rd">3rd Round</option>
                    <option value="Final">Final Round</option>
                  </select>
                </div>
              </div>

              {/* Company */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Company</label>
                <input
                  type="text"
                  value={interviewForm.company}
                  onChange={(e) => setInterviewForm({ ...interviewForm, company: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., DBS Bank"
                />
              </div>

              {/* Location / Meeting Link */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Location / Meeting Link</label>
                <input
                  type="text"
                  value={interviewForm.location}
                  onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Zoom link or office address"
                />
              </div>

              {/* Interviewer */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Interviewer Name</label>
                <input
                  type="text"
                  value={interviewForm.interviewer}
                  onChange={(e) => setInterviewForm({ ...interviewForm, interviewer: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., John Smith (HR Manager)"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">Notes</label>
                <textarea
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Any additional notes for the interview..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowInterviewModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleInterview}
                className="btn-primary"
              >
                Schedule Interview
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Call Outcome Modal */}
        <CallOutcomeModal
          isOpen={showCallOutcomeModal}
          onClose={() => {
            setShowCallOutcomeModal(false);
            setPendingActivityForOutcome(null);
          }}
          candidate={candidate}
          activity={pendingActivityForOutcome}
          onSubmit={handleCallOutcomeSubmit}
        />

        {/* Resume Converter Modal */}
        <ResumeConverterModal
          isOpen={showResumeConverterModal}
          onClose={() => setShowResumeConverterModal(false)}
          candidate={candidate}
        />
      </div>

      {/* Right Side - Resume Preview (Always Visible) */}
      <div className="w-1/2 flex-shrink-0 hidden lg:block mt-[3rem]">
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col sticky top-6 shadow-sm" style={{ height: 'calc(100vh - 7rem)' }}>
          {/* Panel Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cgp-red" />
              Resume Preview
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResumeConverterModal(true)}
                className="btn-primary text-sm flex items-center gap-1"
              >
                <FileOutput className="w-4 h-4" />
                Convert to CGP
              </button>
              {candidate.resume_url && (
                <a
                  href={candidate.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
              )}
            </div>
          </div>
          {/* Resume Viewer or No Resume Message */}
          <div className="flex-1 p-4 min-h-0">
            {candidate.resume_url ? (
              <iframe
                src={candidate.resume_url}
                className="w-full h-full rounded-lg border border-slate-200 bg-white"
                title="Resume Preview"
              />
            ) : (
              <div className="w-full h-full rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
                <FileText className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg">No resume available</p>
                <p className="text-slate-400 text-sm mt-2">Upload a resume to view it here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
