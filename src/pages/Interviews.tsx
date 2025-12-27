import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Building,
  Video,
  Phone,
  Users,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useUpcomingInterviews } from '../hooks/useData';
import type { Interview } from '../types';

const INTERVIEW_TYPE_ICONS: Record<string, React.ElementType> = {
  Video: Video,
  Phone: Phone,
  'In-Person': Users,
  'Assessment Center': Users,
};

function getOutcomeBadge(outcome: string | null) {
  if (!outcome) return null;
  const colors: Record<string, string> = {
    Passed: 'badge-success',
    Failed: 'badge-error',
    Pending: 'badge-warning',
    'No Show': 'badge-error',
  };
  return <span className={`badge ${colors[outcome] || 'badge-neutral'}`}>{outcome}</span>;
}

function InterviewCard({
  interview,
  showDate = false,
}: {
  interview: Interview;
  showDate?: boolean;
}) {
  const Icon = INTERVIEW_TYPE_ICONS[interview.interview_type || 'Video'] || Video;

  return (
    <Link
      to={`/candidates/${interview.candidate_id}`}
      className="card p-5 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-slate-800">{interview.candidate_name}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {interview.job_role} • {interview.interview_round} Round
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <Building className="w-4 h-4 text-slate-400" />
                {interview.client_company}
              </span>
              {showDate && interview.interview_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {format(parseISO(interview.interview_date), 'MMM d')}
                </span>
              )}
              {interview.interview_time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {interview.interview_time}
                </span>
              )}
            </div>
            {interview.location && (
              <p className="text-sm text-slate-400 mt-2 flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {interview.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {interview.status === 'Completed' ? (
            getOutcomeBadge(interview.outcome)
          ) : (
            <div className="flex gap-2">
              {interview.prep_notes_sent ? (
                <span className="badge badge-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Prep Sent
                </span>
              ) : (
                <span className="badge badge-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No Prep
                </span>
              )}
              {interview.candidate_confirmed ? (
                <span className="badge badge-success flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Confirmed
                </span>
              ) : (
                <span className="badge badge-warning flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Pending
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {interview.interviewer_name && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            <span className="text-slate-400">Interviewer:</span> {interview.interviewer_name}
            {interview.interviewer_title && ` (${interview.interviewer_title})`}
          </p>
        </div>
      )}
      {interview.notes && (
        <p className="text-sm text-slate-400 mt-2 italic">{interview.notes}</p>
      )}
    </Link>
  );
}

function InterviewSection({
  title,
  interviews,
  emptyMessage,
  showDate = false,
}: {
  title: string;
  interviews: Interview[];
  emptyMessage: string;
  showDate?: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-slate-400">({interviews.length})</span>
      </h2>
      {interviews.length > 0 ? (
        <div className="space-y-4">
          {interviews.map(interview => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              showDate={showDate}
            />
          ))}
        </div>
      ) : (
        <div className="card p-8 text-center text-slate-400">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}

export default function Interviews() {
  const { data: groupedInterviews, isLoading } = useUpcomingInterviews();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cgp-red"></div>
      </div>
    );
  }

  const groups = groupedInterviews || {
    today: [],
    tomorrow: [],
    thisWeek: [],
    past: [],
  };

  const totalUpcoming = groups.today.length + groups.tomorrow.length + groups.thisWeek.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Interviews</h1>
        <p className="text-slate-500 mt-1">
          {totalUpcoming} upcoming interview{totalUpcoming !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Today</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{groups.today.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Tomorrow</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{groups.tomorrow.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">This Week</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{groups.thisWeek.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{groups.past.length}</p>
        </div>
      </div>

      {/* Interview Sections */}
      <div className="space-y-8">
        <InterviewSection
          title="Today"
          interviews={groups.today}
          emptyMessage="No interviews scheduled for today"
        />
        <InterviewSection
          title="Tomorrow"
          interviews={groups.tomorrow}
          emptyMessage="No interviews scheduled for tomorrow"
        />
        <InterviewSection
          title="This Week"
          interviews={groups.thisWeek}
          emptyMessage="No more interviews this week"
          showDate
        />
        {groups.past.length > 0 && (
          <InterviewSection
            title="Recently Completed"
            interviews={groups.past.slice(0, 5)}
            emptyMessage="No completed interviews"
            showDate
          />
        )}
      </div>
    </div>
  );
}
