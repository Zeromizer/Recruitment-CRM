import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Star,
  Mail,
  ChevronRight,
  Users,
  X,
  Plus,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useCandidates } from '../hooks/useData';
import type { Candidate, CandidateStatus } from '../types';
import { STATUS_LABELS } from '../types';
import AddCandidateModal from '../components/AddCandidateModal';

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

function getAIScoreColor(score: number | null): string {
  if (score === null) return 'text-navy-500';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className="grid grid-cols-12 gap-4 items-center p-4 hover:bg-navy-800/50 transition-colors border-b border-navy-800 last:border-b-0"
    >
      {/* Name & Contact */}
      <div className="col-span-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-navy-700 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-white">
            {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-medium truncate">{candidate.full_name}</p>
          <div className="flex items-center gap-3 text-sm text-navy-400">
            {candidate.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3" />
                <span className="truncate">{candidate.email}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Role */}
      <div className="col-span-2">
        <p className="text-navy-200 truncate">{candidate.applied_role || '-'}</p>
        <p className="text-xs text-navy-500">{candidate.source}</p>
      </div>

      {/* AI Score */}
      <div className="col-span-1">
        <div className={`flex items-center gap-1 ${getAIScoreColor(candidate.ai_score)}`}>
          <Star className="w-4 h-4" />
          <span className="font-medium">{candidate.ai_score ?? '-'}</span>
        </div>
      </div>

      {/* Status */}
      <div className="col-span-2">
        <span className={`badge ${getStatusBadgeClass(candidate.current_status)}`}>
          {STATUS_LABELS[candidate.current_status]}
        </span>
      </div>

      {/* Date Applied */}
      <div className="col-span-2">
        <p className="text-sm text-navy-400">
          {format(parseISO(candidate.date_received), 'MMM d, yyyy')}
        </p>
      </div>

      {/* Arrow */}
      <div className="col-span-1 flex justify-end">
        <ChevronRight className="w-5 h-5 text-navy-500" />
      </div>
    </Link>
  );
}

export default function Candidates() {
  const { data: candidates = [], isLoading } = useCandidates();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Get unique sources for filter
  const sources = useMemo(() => {
    const sourceSet = new Set(candidates.map(c => c.source).filter(Boolean));
    return Array.from(sourceSet).sort();
  }, [candidates]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter(candidate => {
      // Search
      if (search) {
        const term = search.toLowerCase();
        const matches =
          candidate.full_name.toLowerCase().includes(term) ||
          candidate.email?.toLowerCase().includes(term) ||
          candidate.applied_role?.toLowerCase().includes(term) ||
          candidate.phone?.includes(term);
        if (!matches) return false;
      }

      // Status filter
      if (statusFilter && candidate.current_status !== statusFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter && candidate.source !== sourceFilter) {
        return false;
      }

      return true;
    });
  }, [candidates, search, statusFilter, sourceFilter]);

  const hasActiveFilters = statusFilter || sourceFilter;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-coral-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-white">Candidates</h1>
          <p className="text-navy-400 mt-1">
            {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? 's' : ''}
            {hasActiveFilters && ` (filtered from ${candidates.length})`}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Candidate
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-400" />
            <input
              type="text"
              placeholder="Search by name, email, role, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-10"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'border-coral-500 text-coral-400' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-coral-500 text-white text-xs rounded-full flex items-center justify-center">
                {(statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-navy-800">
            <div className="flex flex-wrap gap-4">
              {/* Status Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-navy-400 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as CandidateStatus | '')}
                  className="input w-full"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-navy-400 mb-1">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All Sources</option>
                  {sources.map(source => (
                    <option key={source} value={source!}>{source}</option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStatusFilter('');
                      setSourceFilter('');
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

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 items-center p-4 bg-navy-800/50 text-sm font-medium text-navy-400 border-b border-navy-800">
          <div className="col-span-4">Candidate</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-1">Score</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Applied</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        {filteredCandidates.length > 0 ? (
          <div>
            {filteredCandidates.map(candidate => (
              <CandidateRow key={candidate.id} candidate={candidate} />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-navy-600 mb-4" />
            <p className="text-navy-400">
              {search || hasActiveFilters
                ? 'No candidates match your filters'
                : 'No candidates yet'}
            </p>
          </div>
        )}
      </div>

      {/* Add Candidate Modal */}
      <AddCandidateModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
