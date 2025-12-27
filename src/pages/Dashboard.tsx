import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Star,
  Calendar,
  Briefcase,
  TrendingUp,
  Phone,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useDashboardMetrics, useCandidates, useInterviews } from '../hooks/useData';
import type { Candidate, Interview } from '../types';

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'red',
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color?: 'red' | 'emerald' | 'blue' | 'amber';
}) {
  const colorClasses = {
    red: 'bg-cgp-red/10 text-cgp-red',
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-3xl font-semibold text-slate-800 mt-1">{value}</p>
          {trend && (
            <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function FollowUpCard({ candidate }: { candidate: Candidate }) {
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-cgp-red rounded-full flex items-center justify-center shadow-sm">
          <span className="text-sm font-medium text-white">
            {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        <div>
          <p className="text-slate-800 font-medium">{candidate.full_name}</p>
          <p className="text-sm text-slate-500">{candidate.next_action}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400" />
    </Link>
  );
}

function InterviewCard({ interview }: { interview: Interview }) {
  return (
    <Link
      to={`/candidates/${interview.candidate_id}`}
      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-slate-800 font-medium">{interview.candidate_name}</p>
          <p className="text-sm text-slate-500">
            {interview.client_company} • {interview.interview_time}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {interview.candidate_confirmed ? (
          <span className="badge badge-success">Confirmed</span>
        ) : (
          <span className="badge badge-warning">Pending</span>
        )}
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>
    </Link>
  );
}

function PlacementCard({ candidate }: { candidate: Candidate }) {
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-slate-800 font-medium">{candidate.full_name}</p>
          <p className="text-sm text-slate-500">
            Starting at {candidate.client_submitted_to}
          </p>
        </div>
      </div>
      <span className="badge badge-success">Starting Today</span>
    </Link>
  );
}

function SourceChart({ data }: { data: { source: string; count: number }[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = [
    'bg-cgp-red',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
  ];

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Source Breakdown</h3>
      <div className="space-y-4">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.source}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600">{item.source}</span>
              <span className="text-slate-800 font-medium">{item.count}</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                style={{ width: `${(item.count / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineFunnel({ data }: { data: { stage: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">Pipeline Funnel</h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.stage} className="flex items-center gap-4">
            <div className="w-24 text-sm text-slate-500 text-right">{item.stage}</div>
            <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden flex items-center">
              <div
                className="h-full bg-gradient-to-r from-cgp-red to-cgp-red-dark rounded-lg flex items-center justify-end pr-3"
                style={{
                  width: `${Math.max((item.count / maxCount) * 100, 15)}%`,
                  minWidth: '40px',
                }}
              >
                <span className="text-sm font-medium text-white">{item.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { isLoading: candidatesLoading } = useCandidates();
  const { isLoading: interviewsLoading } = useInterviews();

  const isLoading = metricsLoading || candidatesLoading || interviewsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cgp-red"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Unable to load dashboard data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Candidates"
          value={metrics.totalCandidates}
          icon={Users}
          color="red"
        />
        <MetricCard
          title="New This Week"
          value={metrics.newThisWeek}
          icon={UserPlus}
          trend="+12% from last week"
          color="emerald"
        />
        <MetricCard
          title="Avg AI Score"
          value={metrics.avgAIScore}
          icon={Star}
          color="amber"
        />
        <MetricCard
          title="Today's Interviews"
          value={metrics.todaysInterviews.length}
          icon={Calendar}
          color="blue"
        />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Interviews */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Today's Interviews
              </h3>
              <Link to="/interviews" className="text-sm text-cgp-red hover:text-cgp-red-dark">
                View all
              </Link>
            </div>
            {metrics.todaysInterviews.length > 0 ? (
              <div className="space-y-3">
                {metrics.todaysInterviews.map(interview => (
                  <InterviewCard key={interview.id} interview={interview} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No interviews scheduled for today</p>
              </div>
            )}
          </div>

          {/* Today's Follow-ups */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Phone className="w-5 h-5 text-amber-500" />
                Today's Follow-ups
              </h3>
              <Link to="/candidates" className="text-sm text-cgp-red hover:text-cgp-red-dark">
                View all
              </Link>
            </div>
            {metrics.todaysFollowUps.length > 0 ? (
              <div className="space-y-3">
                {metrics.todaysFollowUps.slice(0, 5).map(candidate => (
                  <FollowUpCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No follow-ups scheduled for today</p>
              </div>
            )}
          </div>

          {/* Placements Starting */}
          {metrics.todaysPlacements.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-500" />
                  Placements Starting Today
                </h3>
              </div>
              <div className="space-y-3">
                {metrics.todaysPlacements.map(candidate => (
                  <PlacementCard key={candidate.id} candidate={candidate} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SourceChart data={metrics.sourceBreakdown} />
          <PipelineFunnel data={metrics.pipelineFunnel} />
        </div>
      </div>
    </div>
  );
}
