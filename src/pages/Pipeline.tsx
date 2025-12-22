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
  placement_started: 'border-t-coral-500',
};

function getAIScoreColor(score: number | null): string {
  if (score === null) return 'text-navy-500';
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  return 'text-red-400';
}

function PipelineCard({ candidate }: { candidate: Candidate }) {
  return (
    <Link
      to={`/candidates/${candidate.id}`}
      className="block p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-navy-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-white">
              {candidate.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{candidate.full_name}</p>
            <p className="text-xs text-navy-400 truncate">{candidate.applied_role}</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-navy-600 group-hover:text-navy-400 transition-colors flex-shrink-0" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`flex items-center gap-1 ${getAIScoreColor(candidate.ai_score)}`}>
          <Star className="w-3 h-3" />
          <span className="text-xs font-medium">{candidate.ai_score ?? '-'}</span>
        </div>
        {candidate.client_submitted_to && (
          <span className="text-xs text-navy-500 truncate max-w-[80px]">
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
      <div className="p-4 border-b border-navy-800">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-white">{PIPELINE_STAGE_LABELS[stage]}</h3>
          <span className="px-2 py-0.5 bg-navy-800 text-navy-400 text-sm rounded-full">
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
          <div className="text-center py-8 text-navy-600">
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-coral-500"></div>
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
        <h1 className="font-display text-3xl text-white">Pipeline</h1>
        <p className="text-navy-400 mt-1">
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
            <span className="text-navy-400">AI Score 8+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-navy-400">AI Score 6-7</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-navy-400">AI Score &lt;6</span>
          </div>
        </div>
      </div>
    </div>
  );
}
