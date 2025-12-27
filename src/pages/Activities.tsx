import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  Briefcase,
  Star,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Clock,
  X,
} from 'lucide-react';
import { format, parseISO, isToday, isYesterday, startOfDay } from 'date-fns';
import { useActivities } from '../hooks/useData';
import type { Activity as ActivityType } from '../types';

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  'Phone Screen': Phone,
  'Phone Interview': Phone,
  'Phone Call': Phone,
  'Email Sent': Mail,
  'WhatsApp Message': MessageSquare,
  'Interview Scheduled': Calendar,
  'Interview Completed': Calendar,
  Submission: Send,
  'Offer Extended': Briefcase,
  'AI Screening': Star,
  Onboarding: Briefcase,
  'Status Change': RefreshCw,
};

const DIRECTION_ICONS: Record<string, React.ElementType> = {
  Inbound: ArrowDownLeft,
  Outbound: ArrowUpRight,
  Internal: RefreshCw,
};

const DIRECTION_COLORS: Record<string, string> = {
  Inbound: 'text-blue-600',
  Outbound: 'text-emerald-600',
  Internal: 'text-slate-400',
};

function ActivityCard({ activity }: { activity: ActivityType }) {
  const Icon = ACTIVITY_ICONS[activity.activity_type] || MessageSquare;
  const DirectionIcon = DIRECTION_ICONS[activity.direction || 'Internal'] || RefreshCw;

  return (
    <div className="flex gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100">
      <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon className="w-5 h-5 text-slate-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800">{activity.activity_type}</p>
            {activity.direction && (
              <DirectionIcon className={`w-4 h-4 ${DIRECTION_COLORS[activity.direction]}`} />
            )}
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            {format(parseISO(activity.activity_date), 'h:mm a')}
          </span>
        </div>
        {activity.candidate_name && (
          <Link
            to={`/candidates/${activity.candidate_id}`}
            className="text-sm text-cgp-red hover:text-cgp-red-dark transition-colors mt-1 inline-block"
          >
            {activity.candidate_name}
          </Link>
        )}
        {activity.subject && (
          <p className="text-sm text-slate-600 mt-1">{activity.subject}</p>
        )}
        {activity.details && (
          <p className="text-sm text-slate-500 mt-1">{activity.details}</p>
        )}
        <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
          {activity.related_job && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3" />
              {activity.related_job}
            </span>
          )}
          {activity.related_client && (
            <span>@ {activity.related_client}</span>
          )}
          {activity.channel && (
            <span className="capitalize">{activity.channel}</span>
          )}
        </div>
        {activity.outcome && (
          <p className="text-sm text-slate-500 mt-2">
            <span className="text-slate-400">Outcome:</span> {activity.outcome}
          </p>
        )}
        {activity.follow_up_required && activity.follow_up_action && (
          <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Follow-up: {activity.follow_up_action}
          </p>
        )}
        {activity.logged_by && (
          <p className="text-xs text-slate-400 mt-2">Logged by {activity.logged_by}</p>
        )}
      </div>
    </div>
  );
}

function ActivityGroup({
  date,
  activities,
}: {
  date: Date;
  activities: ActivityType[];
}) {
  let dateLabel = format(date, 'EEEE, MMMM d, yyyy');
  if (isToday(date)) {
    dateLabel = 'Today';
  } else if (isYesterday(date)) {
    dateLabel = 'Yesterday';
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-slate-500 mb-4 sticky top-0 bg-slate-50 py-2">
        {dateLabel}
        <span className="text-slate-400 ml-2">({activities.length})</span>
      </h3>
      <div className="space-y-3">
        {activities.map(activity => (
          <ActivityCard key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  );
}

export default function Activities() {
  const { data: activities = [], isLoading } = useActivities();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique activity types for filter
  const activityTypes = useMemo(() => {
    const types = new Set(activities.map(a => a.activity_type).filter(Boolean));
    return Array.from(types).sort();
  }, [activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search
      if (search) {
        const term = search.toLowerCase();
        const matches =
          activity.candidate_name?.toLowerCase().includes(term) ||
          activity.activity_type.toLowerCase().includes(term) ||
          activity.subject?.toLowerCase().includes(term) ||
          activity.details?.toLowerCase().includes(term);
        if (!matches) return false;
      }

      // Type filter
      if (typeFilter && activity.activity_type !== typeFilter) {
        return false;
      }

      // Direction filter
      if (directionFilter && activity.direction !== directionFilter) {
        return false;
      }

      return true;
    });
  }, [activities, search, typeFilter, directionFilter]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups = new Map<string, ActivityType[]>();

    filteredActivities.forEach(activity => {
      const date = startOfDay(parseISO(activity.activity_date)).toISOString();
      const group = groups.get(date) || [];
      group.push(activity);
      groups.set(date, group);
    });

    return Array.from(groups.entries())
      .map(([date, items]) => ({
        date: parseISO(date),
        activities: items.sort((a, b) =>
          new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
        ),
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [filteredActivities]);

  const hasActiveFilters = typeFilter || directionFilter;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cgp-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Activities</h1>
        <p className="text-slate-500 mt-1">
          {filteredActivities.length} activit{filteredActivities.length !== 1 ? 'ies' : 'y'}
          {hasActiveFilters && ` (filtered from ${activities.length})`}
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'border-cgp-red text-cgp-red' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-cgp-red text-white text-xs rounded-full flex items-center justify-center">
                {(typeFilter ? 1 : 0) + (directionFilter ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-4">
              {/* Type Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Activity Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All Types</option>
                  {activityTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Direction Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Direction</label>
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All Directions</option>
                  <option value="Inbound">Inbound</option>
                  <option value="Outbound">Outbound</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setTypeFilter('');
                      setDirectionFilter('');
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Activities List */}
      {groupedActivities.length > 0 ? (
        <div className="space-y-8">
          {groupedActivities.map(group => (
            <ActivityGroup
              key={group.date.toISOString()}
              date={group.date}
              activities={group.activities}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Activity className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">
            {search || hasActiveFilters
              ? 'No activities match your filters'
              : 'No activities logged yet'}
          </p>
        </div>
      )}
    </div>
  );
}
