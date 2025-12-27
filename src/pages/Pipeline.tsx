import { Link } from 'react-router-dom';
import { Star, User, ChevronRight } from 'lucide-react';
import { usePipelineCandidates } from '../hooks/useData';
import type { Candidate, PipelineStage } from '../types';
import { PIPELINE_STAGE_LABELS } from '../types';

const STAGES: PipelineStage[] = [
  'shortlisted',
  'submitted_to_client',
  'interview_scheduled',
  'interview_completed',
  'offer_extended',
  'offer_accepted',
  'placement_started',
];

const STAGE_COLORS: Record<PipelineStage, string> = {
  shortlisted: 'border-t-blue-500',
  submitted_to_client: 'border-t-amber-500',
  interview_scheduled: 'border-t-purple-500',
  interview_completed: 'border-t-indigo-500',
  offer_extended: 'border-t-emerald-500',
  offer_accepted: 'border-t-teal-500',
  placement_started: 'border-t-cgp-red',
};

function getAIScoreColor(score: number | null): string {
  if (score === null) return 'text-slate-400';
  if (score >= 8) return 'text-emerald-600';
  if (score >= 6) return 'text-amber-600';
  return 'text-red-600';
}

function PipelineCard({ candidate }: { candidate: Candidate }) {
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className="block p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group border border-slate-100"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cgp-red rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-xs font-medium text-white">
              {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{candidate.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{candidate.applied_role}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`flex items-center gap-1 ${getAIScoreColor(candidate.ai_score)}`}>
          <Star className="w-3 h-3" />
          <span className="text-xs font-medium">{candidate.ai_score ?? '-'}</span>
        </div>
        {candidate.client_submitted_to && (
          <span className="text-xs text-slate-400 truncate max-w-[80px]">
            {candidate.client_submitted_to}
          </span>
        )}
      </div>
    </Link>
  );
}

function PipelineColumn({
  stage,
  candidates,
}: {
  stage: PipelineStage;
  candidates: Candidate[];
}) {
  return (
    <div className={`card border-t-4 ${STAGE_COLORS[stage]} flex flex-col min-w-[280px] max-w-[320px]`}>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-slate-800">{PIPELINE_STAGE_LABELS[stage]}</h3>
          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-sm rounded-full">
            {candidates.length}
          </span>
        </div>
      </div>
      <div className="p-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)] space-y-2">
        {candidates.length > 0 ? (
          candidates.map(candidate => (
            <PipelineCard key={candidate.id} candidate={candidate} />
          ))
        ) : (
          <div className="text-center py-8 text-slate-400">
            <User className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">No candidates</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Pipeline() {
  const { data: pipelineCandidates, isLoading } = usePipelineCandidates();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cgp-red"></div>
      </div>
    );
  }

  const stages = pipelineCandidates || {
    shortlisted: [],
    submitted_to_client: [],
    interview_scheduled: [],
    interview_completed: [],
    offer_extended: [],
    offer_accepted: [],
    placement_started: [],
  };

  const totalInPipeline = Object.values(stages).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Pipeline</h1>
        <p className="text-slate-500 mt-1">
          {totalInPipeline} candidate{totalInPipeline !== 1 ? 's' : ''} in pipeline
        </p>
      </div>

      {/* Pipeline Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map(stage => (
            <PipelineColumn
              key={stage}
              stage={stage}
              candidates={stages[stage]}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-slate-500">AI Score 8+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-slate-500">AI Score 6-7</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-slate-500">AI Score &lt;6</span>
          </div>
        </div>
      </div>
    </div>
  );
}
