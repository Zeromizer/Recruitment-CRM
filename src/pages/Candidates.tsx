import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  if (score === null) return 'text-slate-400';
  if (score >= 8) return 'text-emerald-600';
  if (score >= 6) return 'text-amber-600';
  return 'text-red-600';
}

function getAICategoryBadgeClass(category: string | null): string {
  if (!category) return 'bg-slate-100 text-slate-600';
  if (category === 'Top Candidate') return 'bg-emerald-100 text-emerald-700';
  if (category === 'Review') return 'bg-amber-100 text-amber-700';
  if (category === 'Rejected') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function getCitizenshipBadgeClass(citizenship: string | null): string {
  if (!citizenship) return 'bg-slate-100 text-slate-600';
  if (citizenship === 'SC') return 'bg-emerald-100 text-emerald-700';
  if (citizenship === 'PR') return 'bg-blue-100 text-blue-700';
  if (citizenship === 'Foreign') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600'; // Not Identified
}

function getCitizenshipLabel(citizenship: string | null): string {
  if (!citizenship) return '-';
  if (citizenship === 'SC') return 'SC';
  if (citizenship === 'PR') return 'PR';
  if (citizenship === 'Not Identified') return 'N/A';
  return citizenship; // Foreign or other countries
}

interface CandidateRowProps {
  candidate: Candidate;
  isHighlighted?: boolean;
  onRowClick?: () => void;
  rowRef?: React.RefObject<HTMLAnchorElement | null>;
}

function CandidateRow({ candidate, isHighlighted, onRowClick, rowRef }: CandidateRowProps) {
  return (
    <Link
      ref={rowRef}
      to={`/candidates/${candidate.id}`}
      onClick={onRowClick}
      className={`grid grid-cols-12 gap-4 items-center p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 ${
        isHighlighted ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset animate-highlight-fade' : ''
      }`}
    >
      {/* Name & Contact */}
      <div className="col-span-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-cgp-red rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
          <span className="text-sm font-medium text-white">
            {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-slate-800 font-medium truncate">{candidate.full_name}</p>
          <div className="flex items-center gap-3 text-sm text-slate-500">
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
        <p className="text-slate-700 truncate">{candidate.applied_role || '-'}</p>
        <p className="text-xs text-slate-400">{candidate.source}</p>
      </div>

      {/* AI Score */}
      <div className="col-span-1">
        <div className={`flex items-center gap-1 ${getAIScoreColor(candidate.ai_score)}`}>
          <Star className="w-4 h-4" />
          <span className="font-medium">{candidate.ai_score ?? '-'}</span>
        </div>
      </div>

      {/* AI Category (Screening Result) */}
      <div className="col-span-1">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAICategoryBadgeClass(candidate.ai_category)}`}>
          {candidate.ai_category || '-'}
        </span>
      </div>

      {/* Citizenship */}
      <div className="col-span-1">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCitizenshipBadgeClass(candidate.citizenship_status)}`}>
          {getCitizenshipLabel(candidate.citizenship_status)}
        </span>
      </div>

      {/* Status */}
      <div className="col-span-2">
        <span className={`badge ${getStatusBadgeClass(candidate.current_status)}`}>
          {STATUS_LABELS[candidate.current_status]}
        </span>
      </div>

      {/* Date Applied */}
      <div className="col-span-1">
        <p className="text-sm text-slate-500">
          {format(parseISO(candidate.date_received), 'MMM d, yyyy')}
        </p>
        <p className="text-xs text-slate-400">
          {format(parseISO(candidate.date_received), 'h:mm a')}
        </p>
      </div>

      {/* Arrow */}
      <div className="col-span-1 flex justify-end">
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </div>
    </Link>
  );
}

// Storage keys for persisting filter state
const FILTER_STORAGE_KEY = 'candidatesFilters';
const LAST_VIEWED_CANDIDATE_KEY = 'lastViewedCandidate';

interface FilterState {
  search: string;
  statusFilter: CandidateStatus | '';
  sourceFilter: string;
  roleFilter: string;
  minScoreFilter: number | '';
  aiCategoryFilter: string;
  citizenshipFilter: string;
  showFilters: boolean;
}

function loadFiltersFromStorage(): Partial<FilterState> {
  try {
    const stored = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load filters from storage:', e);
  }
  return {};
}

function saveFiltersToStorage(filters: FilterState): void {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Failed to save filters to storage:', e);
  }
}

function getLastViewedCandidate(): string | null {
  try {
    return sessionStorage.getItem(LAST_VIEWED_CANDIDATE_KEY);
  } catch (e) {
    return null;
  }
}

function setLastViewedCandidate(id: string): void {
  try {
    sessionStorage.setItem(LAST_VIEWED_CANDIDATE_KEY, id);
  } catch (e) {
    console.error('Failed to save last viewed candidate:', e);
  }
}

function clearLastViewedCandidate(): void {
  try {
    sessionStorage.removeItem(LAST_VIEWED_CANDIDATE_KEY);
  } catch (e) {
    // Ignore
  }
}

export default function Candidates() {
  const { data: candidates = [], isLoading } = useCandidates();

  // Load initial filter state from sessionStorage
  const initialFilters = useMemo(() => loadFiltersFromStorage(), []);

  const [search, setSearch] = useState(initialFilters.search || '');
  const [statusFilter, setStatusFilter] = useState<CandidateStatus | ''>(initialFilters.statusFilter || '');
  const [sourceFilter, setSourceFilter] = useState(initialFilters.sourceFilter || '');
  const [roleFilter, setRoleFilter] = useState(initialFilters.roleFilter || '');
  const [minScoreFilter, setMinScoreFilter] = useState<number | ''>(initialFilters.minScoreFilter ?? '');
  const [aiCategoryFilter, setAiCategoryFilter] = useState<string>(initialFilters.aiCategoryFilter || '');
  const [citizenshipFilter, setCitizenshipFilter] = useState<string>(initialFilters.citizenshipFilter || '');
  const [showFilters, setShowFilters] = useState(initialFilters.showFilters || false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasUsedFilters, setHasUsedFilters] = useState(false);

  // Track the last viewed candidate for highlighting
  const [highlightedCandidateId, setHighlightedCandidateId] = useState<string | null>(() => getLastViewedCandidate());
  const highlightedRowRef = useRef<HTMLAnchorElement | null>(null);

  // Save filters to sessionStorage whenever they change
  useEffect(() => {
    saveFiltersToStorage({
      search,
      statusFilter,
      sourceFilter,
      roleFilter,
      minScoreFilter,
      aiCategoryFilter,
      citizenshipFilter,
      showFilters,
    });
  }, [search, statusFilter, sourceFilter, roleFilter, minScoreFilter, aiCategoryFilter, citizenshipFilter, showFilters]);

  // Scroll to highlighted candidate on initial load and clear highlight after delay
  useEffect(() => {
    if (highlightedCandidateId && highlightedRowRef.current) {
      // Wait for the DOM to settle before scrolling
      const scrollTimer = setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);

      // Clear the highlight after 3 seconds
      const fadeTimer = setTimeout(() => {
        setHighlightedCandidateId(null);
        clearLastViewedCandidate();
      }, 3000);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(fadeTimer);
      };
    }
  }, [highlightedCandidateId, candidates]); // Re-run when candidates load

  // Handler for clicking on a candidate row
  const handleCandidateClick = useCallback((candidateId: string) => {
    setLastViewedCandidate(candidateId);
  }, []);

  // Get unique sources for filter (dynamic - only shows sources that exist in candidates)
  const sources = useMemo(() => {
    const sourceSet = new Set(candidates.map(c => c.source).filter(Boolean));
    return Array.from(sourceSet).sort();
  }, [candidates]);

  // Get unique roles for filter
  const roles = useMemo(() => {
    const roleSet = new Set(candidates.map(c => c.applied_role).filter(Boolean));
    return Array.from(roleSet).sort() as string[];
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

      // Role filter
      if (roleFilter && candidate.applied_role !== roleFilter) {
        return false;
      }

      // Minimum score filter
      if (minScoreFilter !== '' && (candidate.ai_score === null || candidate.ai_score < minScoreFilter)) {
        return false;
      }

      // AI Category filter
      if (aiCategoryFilter && candidate.ai_category !== aiCategoryFilter) {
        return false;
      }

      // Citizenship filter
      if (citizenshipFilter && candidate.citizenship_status !== citizenshipFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort by date_received descending (newest first)
      return new Date(b.date_received).getTime() - new Date(a.date_received).getTime();
    });
  }, [candidates, search, statusFilter, sourceFilter, roleFilter, minScoreFilter, aiCategoryFilter, citizenshipFilter]);

  const hasActiveFilters = statusFilter || sourceFilter || roleFilter || minScoreFilter !== '' || aiCategoryFilter || citizenshipFilter;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Candidates</h1>
          <p className="text-slate-500 mt-1">
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
            onClick={() => {
              setShowFilters(!showFilters);
              setHasUsedFilters(true);
            }}
            className={`btn-secondary flex items-center gap-2 ${hasActiveFilters ? 'border-cgp-red text-cgp-red' : ''} ${!hasUsedFilters && !hasActiveFilters ? 'animate-filter-pulse' : ''}`}
          >
            <Filter className={`w-4 h-4 ${!hasUsedFilters && !hasActiveFilters ? 'animate-bounce-subtle' : ''}`} />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 bg-cgp-red text-white text-xs rounded-full flex items-center justify-center">
                {(statusFilter ? 1 : 0) + (sourceFilter ? 1 : 0) + (roleFilter ? 1 : 0) + (minScoreFilter !== '' ? 1 : 0) + (aiCategoryFilter ? 1 : 0) + (citizenshipFilter ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex flex-wrap gap-4">
              {/* Status Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Status</label>
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
                <label className="block text-sm text-slate-500 mb-1">Source</label>
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

              {/* Role Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Job Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All Roles</option>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Minimum Score Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Minimum AI Score</label>
                <select
                  value={minScoreFilter}
                  onChange={(e) => setMinScoreFilter(e.target.value === '' ? '' : Number(e.target.value))}
                  className="input w-full"
                >
                  <option value="">Any Score</option>
                  <option value="8">8+ (Top Candidates)</option>
                  <option value="7">7+</option>
                  <option value="6">6+</option>
                  <option value="5">5+</option>
                  <option value="4">4+</option>
                  <option value="3">3+</option>
                </select>
              </div>

              {/* AI Category Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">AI Screening Result</label>
                <select
                  value={aiCategoryFilter}
                  onChange={(e) => setAiCategoryFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All Categories</option>
                  <option value="Top Candidate">Top Candidate</option>
                  <option value="Review">Review</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Citizenship Filter */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm text-slate-500 mb-1">Citizenship</label>
                <select
                  value={citizenshipFilter}
                  onChange={(e) => setCitizenshipFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="">All</option>
                  <option value="SC">Singapore Citizen (SC)</option>
                  <option value="PR">Permanent Resident (PR)</option>
                  <option value="Foreign">Foreign</option>
                  <option value="Not Identified">Not Identified</option>
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setStatusFilter('');
                      setSourceFilter('');
                      setRoleFilter('');
                      setMinScoreFilter('');
                      setAiCategoryFilter('');
                      setCitizenshipFilter('');
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
        <div className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 text-sm font-medium text-slate-500 border-b border-slate-200">
          <div className="col-span-3">Candidate</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-1">Score</div>
          <div className="col-span-1">AI Result</div>
          <div className="col-span-1">Citizenship</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Applied</div>
          <div className="col-span-1"></div>
        </div>

        {/* Table Body */}
        {filteredCandidates.length > 0 ? (
          <div>
            {filteredCandidates.map(candidate => (
              <CandidateRow
                key={candidate.id}
                candidate={candidate}
                isHighlighted={candidate.id === highlightedCandidateId}
                onRowClick={() => handleCandidateClick(candidate.id)}
                rowRef={candidate.id === highlightedCandidateId ? highlightedRowRef : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">
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
