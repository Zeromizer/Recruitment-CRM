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
  ExternalLink,
  Send,
  PhoneCall,
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

  return (
    <div className="space-y-6">
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
                onClick={() => handleQuickAction('Interview Scheduled')}
                className="btn-secondary flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Schedule Interview
              </button>
              {candidate.resume_url && (
                <a
                  href={candidate.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  View Resume
                  <ExternalLink className="w-3 h-3" />
                </a>
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
    </div>
  );
}
