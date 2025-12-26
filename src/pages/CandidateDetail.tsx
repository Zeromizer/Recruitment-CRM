import { useState } from 'react';
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
  ChevronRight,
  ExternalLink,
  Send,
  PhoneCall,
  X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  useCandidate,
  useCandidateActivities,
  useCandidateInterviews,
  useUpdateCandidateStatus,
  useUpdateCandidate,
  useCreateActivity,
} from '../hooks/useData';
import type { CandidateStatus, Activity } from '../types';
import { STATUS_LABELS } from '../types';

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

function ActivityItem({ activity }: { activity: Activity }) {
  const iconMap: Record<string, React.ElementType> = {
    'Phone Screen': PhoneCall,
    'Phone Interview': PhoneCall,
    'Email Sent': Mail,
    'WhatsApp Message': MessageSquare,
    'Interview Scheduled': Calendar,
    'Interview Completed': Calendar,
    'Submission': Send,
    'Offer Extended': Briefcase,
    'AI Screening': Star,
    'Onboarding': Briefcase,
  };
  const Icon = iconMap[activity.activity_type] || MessageSquare;

  return (
    <div className="flex gap-4 p-4 bg-navy-800/30 rounded-lg">
      <div className="w-10 h-10 bg-navy-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-navy-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-white">{activity.activity_type}</p>
          <span className="text-xs text-navy-400 whitespace-nowrap">
            {format(parseISO(activity.activity_date), 'MMM d, h:mm a')}
          </span>
        </div>
        {activity.subject && (
          <p className="text-sm text-navy-300 mt-1">{activity.subject}</p>
        )}
        {activity.details && (
          <p className="text-sm text-navy-400 mt-1">{activity.details}</p>
        )}
        {activity.outcome && (
          <p className="text-sm text-navy-400 mt-2">
            <span className="text-navy-500">Outcome:</span> {activity.outcome}
          </p>
        )}
        {activity.follow_up_required && activity.follow_up_action && (
          <p className="text-sm text-amber-400 mt-2 flex items-center gap-1">
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
  const { data: activities = [] } = useCandidateActivities(id!);
  const { data: interviews = [] } = useCandidateInterviews(id!);
  const updateStatus = useUpdateCandidateStatus();
  const updateCandidate = useUpdateCandidate();
  const createActivity = useCreateActivity();

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
    const [showResumePreview, setShowResumePreview] = useState(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-coral-500"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="text-center py-12">
        <p className="text-navy-400">Candidate not found</p>
        <Link to="/candidates" className="text-coral-400 hover:text-coral-300 mt-2 inline-block">
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

  const handleQuickAction = async (actionType: string) => {
    await createActivity.mutateAsync({
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
      {/* Main Content Area */}
      <div className={`flex-1 min-w-0 space-y-6 transition-all duration-300 ${showResumePreview && candidate.resume_url ? 'w-1/2' : 'w-full'}`}>
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-navy-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-navy-700 rounded-full flex items-center justify-center">
                  <span className="text-xl font-medium text-white">
                    {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h1 className="font-display text-2xl text-white">{candidate.full_name}</h1>
                  <p className="text-navy-400 mt-1">{candidate.applied_role}</p>
                  <div className="flex items-center gap-3 mt-3">
                    {getCitizenshipBadge(candidate.citizenship_status)}
                    {getAICategoryBadge(candidate.ai_category)}
                  </div>
                </div>
              </div>

              {/* Status Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                  className={`badge ${getStatusBadgeClass(candidate.current_status)} flex items-center gap-1 cursor-pointer hover:opacity-80`}
                >
                  {STATUS_LABELS[candidate.current_status]}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-navy-800 border border-navy-700 rounded-lg shadow-xl z-10 max-h-80 overflow-y-auto">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status as CandidateStatus)}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-navy-700 transition-colors ${
                          status === candidate.current_status ? 'text-coral-400' : 'text-navy-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="mt-6 flex flex-wrap gap-4">
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  className="flex items-center gap-2 text-navy-300 hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {candidate.email}
                </a>
              )}
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  className="flex items-center gap-2 text-navy-300 hover:text-white transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  {candidate.phone}
                </a>
              )}
              {candidate.source && (
                <span className="flex items-center gap-2 text-navy-400">
                  <MapPin className="w-4 h-4" />
                  Source: {candidate.source}
                </span>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
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
              <button
                onClick={() => setShowInterviewModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule Interview
              </button>
              {candidate.resume_url && (
                <button
                  onClick={() => setShowResumePreview(!showResumePreview)}
                  className={`btn-secondary flex items-center gap-2 ${showResumePreview ? 'bg-navy-700 border-coral-500' : ''}`}
                >
                  <FileText className="w-4 h-4" />
                  {showResumePreview ? 'Hide Resume' : 'View Resume'}
                </button>
              )}
            </div>
          </div>

          {/* AI Assessment */}
          {candidate.ai_score && (
            <div className="card p-6">
              <h2 className="font-display text-lg text-white flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-400" />
                AI Assessment
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-navy-400">Score</p>
                  <p className="text-3xl font-semibold text-white mt-1">
                    {candidate.ai_score}
                    <span className="text-lg text-navy-500">/10</span>
                  </p>
                </div>
                <div className="bg-navy-800/50 rounded-lg p-4">
                  <p className="text-sm text-navy-400">Category</p>
                  <p className="text-xl font-medium text-white mt-1">{candidate.ai_category}</p>
                </div>
              </div>
              {candidate.ai_summary && (
                <div className="mb-4">
                  <p className="text-sm text-navy-400 mb-1">Summary</p>
                  <p className="text-navy-200">{candidate.ai_summary}</p>
                </div>
              )}
              {candidate.ai_reasoning && (
                <div>
                  <p className="text-sm text-navy-400 mb-1">Reasoning</p>
                  <p className="text-navy-200">{candidate.ai_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Activity Timeline */}
          <div className="card p-6">
            <h2 className="font-display text-lg text-white flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-400" />
              Activity Timeline
            </h2>
            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map(activity => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <p className="text-navy-400 text-center py-8">No activities logged yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="card p-6">
            <h2 className="font-display text-lg text-white mb-4">Details</h2>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-navy-400">Date Received</dt>
                <dd className="text-navy-200">
                  {format(parseISO(candidate.date_received), 'MMM d, yyyy')}
                </dd>
              </div>
              {candidate.assigned_recruiter && (
                <div>
                  <dt className="text-sm text-navy-400">Assigned To</dt>
                  <dd className="text-navy-200">{candidate.assigned_recruiter}</dd>
                </div>
              )}
              {candidate.client_submitted_to && (
                <div>
                  <dt className="text-sm text-navy-400">Submitted To</dt>
                  <dd className="text-navy-200">{candidate.client_submitted_to}</dd>
                </div>
              )}
              {candidate.submission_date && (
                <div>
                  <dt className="text-sm text-navy-400">Submission Date</dt>
                  <dd className="text-navy-200">
                    {format(parseISO(candidate.submission_date), 'MMM d, yyyy')}
                  </dd>
                </div>
              )}
              {candidate.interview_date && (
                <div>
                  <dt className="text-sm text-navy-400">Interview Date</dt>
                  <dd className="text-navy-200">
                    {format(parseISO(candidate.interview_date), 'MMM d, yyyy')}
                    {candidate.interview_outcome && (
                      <span className="ml-2 text-sm text-navy-400">
                        ({candidate.interview_outcome})
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {candidate.offer_date && (
                <div>
                  <dt className="text-sm text-navy-400">Offer Date</dt>
                  <dd className="text-navy-200">
                    {format(parseISO(candidate.offer_date), 'MMM d, yyyy')}
                    {candidate.offer_status && (
                      <span className="ml-2 text-sm text-navy-400">
                        ({candidate.offer_status})
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {candidate.start_date && (
                <div>
                  <dt className="text-sm text-navy-400">Start Date</dt>
                  <dd className="text-navy-200">
                    {format(parseISO(candidate.start_date), 'MMM d, yyyy')}
                  </dd>
                </div>
              )}
              {(candidate.hourly_rate || candidate.bill_rate) && (
                <div>
                  <dt className="text-sm text-navy-400">Rates</dt>
                  <dd className="text-navy-200">
                    {candidate.hourly_rate && `$${candidate.hourly_rate}/hr`}
                    {candidate.hourly_rate && candidate.bill_rate && ' / '}
                    {candidate.bill_rate && `$${candidate.bill_rate} bill`}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Next Action */}
          {candidate.next_action && (
            <div className="card p-6 border-l-4 border-l-amber-500">
              <h2 className="font-display text-lg text-white mb-2">Next Action</h2>
              <p className="text-navy-200">{candidate.next_action}</p>
              {candidate.next_action_date && (
                <p className="text-sm text-amber-400 mt-2 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(parseISO(candidate.next_action_date), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-white">Notes</h2>
              {!editingNotes && (
                <button
                  onClick={() => {
                    setNotes(candidate.notes || '');
                    setEditingNotes(true);
                  }}
                  className="text-sm text-coral-400 hover:text-coral-300"
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
              <p className="text-navy-300">
                {candidate.notes || 'No notes yet'}
              </p>
            )}
          </div>

          {/* Upcoming Interviews */}
          {interviews.filter(i => i.status === 'Scheduled').length > 0 && (
            <div className="card p-6">
              <h2 className="font-display text-lg text-white mb-4">Upcoming Interviews</h2>
              <div className="space-y-3">
                {interviews
                  .filter(i => i.status === 'Scheduled')
                  .map(interview => (
                    <div
                      key={interview.id}
                      className="p-3 bg-navy-800/50 rounded-lg"
                    >
                      <p className="text-white font-medium">{interview.client_company}</p>
                      <p className="text-sm text-navy-400 mt-1">
                        {interview.interview_date && format(parseISO(interview.interview_date), 'MMM d')}
                        {interview.interview_time && ` at ${interview.interview_time}`}
                      </p>
                      <p className="text-sm text-navy-500 mt-1">
                        {interview.interview_type} • {interview.interview_round} Round
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Schedule Interview Modal */}
        {showInterviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-navy-700">
              <h2 className="font-display text-xl text-white">Schedule Interview</h2>
              <button
                onClick={() => setShowInterviewModal(false)}
                className="text-navy-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Date and Time - Required */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-navy-400 mb-1">
                    Date <span className="text-coral-400">*</span>
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
                  <label className="block text-sm text-navy-400 mb-1">
                    Time <span className="text-coral-400">*</span>
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
                  <label className="block text-sm text-navy-400 mb-1">Interview Type</label>
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
                  <label className="block text-sm text-navy-400 mb-1">Round</label>
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
                <label className="block text-sm text-navy-400 mb-1">Company</label>
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
                <label className="block text-sm text-navy-400 mb-1">Location / Meeting Link</label>
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
                <label className="block text-sm text-navy-400 mb-1">Interviewer Name</label>
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
                <label className="block text-sm text-navy-400 mb-1">Notes</label>
                <textarea
                  value={interviewForm.notes}
                  onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Any additional notes for the interview..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-navy-700">
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
      </div>

      {/* Resume Preview Side Panel */}
      {showResumePreview && candidate.resume_url && (
        <div className="w-1/2 flex-shrink-0 h-[calc(100vh-8rem)] sticky top-24 transition-all duration-300">
          <div className="bg-navy-900 border border-navy-700 rounded-xl h-full flex flex-col">
            {/* Panel Header */}
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h2 className="font-display text-lg text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-coral-400" />
                Resume Preview
              </h2>
              <div className="flex items-center gap-2">
                <a
                  href={candidate.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </a>
                <button
                  onClick={() => setShowResumePreview(false)}
                  className="flex items-center gap-1 text-navy-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-navy-800"
                  title="Close panel"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* PDF Viewer */}
            <div className="flex-1 p-4 overflow-hidden">
              <iframe
                src={candidate.resume_url}
                className="w-full h-full rounded-lg border border-navy-700 bg-white"
                title="Resume Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
