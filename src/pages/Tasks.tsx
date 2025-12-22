import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Calendar,
  Building2,
  Phone,
  Mail,
  FileCheck,
  Briefcase,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import { useCandidates } from '../hooks/useData';
import type { Candidate, CandidateStatus } from '../types';

// Define pipeline stages and their required actions
const PIPELINE_TASKS: Record<string, { label: string; tasks: string[]; nextStatus: CandidateStatus }> = {
  new_application: {
    label: 'New Application',
    tasks: ['Review application', 'Check AI assessment', 'Make screening decision'],
    nextStatus: 'ai_screened',
  },
  ai_screened: {
    label: 'AI Screened',
    tasks: ['Review AI assessment', 'Verify citizenship status', 'Decide to shortlist or reject'],
    nextStatus: 'human_reviewed',
  },
  human_reviewed: {
    label: 'Human Reviewed',
    tasks: ['Initial phone screening', 'Discuss role expectations', 'Add to shortlist if suitable'],
    nextStatus: 'shortlisted',
  },
  shortlisted: {
    label: 'Shortlisted',
    tasks: ['Match with suitable client/role', 'Prepare candidate profile', 'Submit to client'],
    nextStatus: 'submitted_to_client',
  },
  submitted_to_client: {
    label: 'Submitted to Client',
    tasks: ['Follow up with client', 'Get client feedback', 'Schedule interview if approved'],
    nextStatus: 'interview_scheduled',
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    tasks: ['Send interview prep notes', 'Confirm candidate attendance', 'Brief candidate on company'],
    nextStatus: 'interview_completed',
  },
  interview_completed: {
    label: 'Interview Completed',
    tasks: ['Get candidate feedback', 'Get client feedback', 'Discuss next steps'],
    nextStatus: 'offer_extended',
  },
  offer_extended: {
    label: 'Offer Extended',
    tasks: ['Present offer to candidate', 'Negotiate terms if needed', 'Get acceptance confirmation'],
    nextStatus: 'offer_accepted',
  },
  offer_accepted: {
    label: 'Offer Accepted',
    tasks: ['Coordinate start date', 'Complete paperwork', 'Prepare onboarding info'],
    nextStatus: 'placement_started',
  },
  placement_started: {
    label: 'Placement Started',
    tasks: ['First day check-in', 'First week follow-up', 'Ensure smooth onboarding'],
    nextStatus: 'placement_completed',
  },
};

interface TaskItem {
  id: string;
  candidate: Candidate;
  task: string;
  taskIndex: number;
  stage: string;
  stageLabel: string;
  dueDate: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
}

function generateTasksForCandidate(candidate: Candidate): TaskItem[] {
  const stageConfig = PIPELINE_TASKS[candidate.current_status];
  if (!stageConfig) return [];

  // Skip completed/rejected statuses
  if (['placement_completed', 'rejected_ai', 'rejected_human', 'rejected_client', 'withdrawn', 'blacklisted', 'on_hold'].includes(candidate.current_status)) {
    return [];
  }

  const tasks: TaskItem[] = [];
  const baseDate = candidate.next_action_date
    ? parseISO(candidate.next_action_date)
    : candidate.updated_at
      ? parseISO(candidate.updated_at)
      : new Date();

  stageConfig.tasks.forEach((task, index) => {
    const dueDate = addDays(baseDate, index); // Stagger due dates
    const dueDateStr = format(dueDate, 'yyyy-MM-dd');

    tasks.push({
      id: `${candidate.id}-${candidate.current_status}-${index}`,
      candidate,
      task,
      taskIndex: index,
      stage: candidate.current_status,
      stageLabel: stageConfig.label,
      dueDate: dueDateStr,
      isOverdue: isPast(dueDate) && !isToday(dueDate),
      isDueToday: isToday(dueDate),
      isDueTomorrow: isTomorrow(dueDate),
    });
  });

  return tasks;
}

function TaskCard({ task, onComplete }: { task: TaskItem; onComplete: () => void }) {
  const priorityClass = task.isOverdue
    ? 'border-l-red-500 bg-red-500/5'
    : task.isDueToday
      ? 'border-l-amber-500 bg-amber-500/5'
      : task.isDueTomorrow
        ? 'border-l-blue-500 bg-blue-500/5'
        : 'border-l-navy-600';

  return (
    <div className={`card p-4 border-l-4 ${priorityClass} hover:bg-navy-800/50 transition-colors`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onComplete}
          className="mt-0.5 text-navy-500 hover:text-green-400 transition-colors"
          title="Mark as complete"
        >
          <Circle className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium">{task.task}</p>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <Link
              to={`/candidates/${task.candidate.id}`}
              className="flex items-center gap-1 text-coral-400 hover:text-coral-300"
            >
              <User className="w-4 h-4" />
              {task.candidate.full_name}
            </Link>

            <span className="flex items-center gap-1 text-navy-400">
              <Briefcase className="w-4 h-4" />
              {task.candidate.applied_role || 'No role'}
            </span>

            {task.candidate.client_submitted_to && (
              <span className="flex items-center gap-1 text-navy-400">
                <Building2 className="w-4 h-4" />
                {task.candidate.client_submitted_to}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="badge badge-neutral text-xs">{task.stageLabel}</span>

            {task.dueDate && (
              <span className={`flex items-center gap-1 text-xs ${
                task.isOverdue ? 'text-red-400' :
                task.isDueToday ? 'text-amber-400' :
                task.isDueTomorrow ? 'text-blue-400' : 'text-navy-400'
              }`}>
                <Clock className="w-3 h-3" />
                {task.isOverdue ? 'Overdue' :
                 task.isDueToday ? 'Due today' :
                 task.isDueTomorrow ? 'Due tomorrow' :
                 format(parseISO(task.dueDate), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {task.candidate.phone && (
            <a
              href={`tel:${task.candidate.phone}`}
              className="p-2 text-navy-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
              title="Call"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {task.candidate.email && (
            <a
              href={`mailto:${task.candidate.email}`}
              className="p-2 text-navy-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
              title="Email"
            >
              <Mail className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const { data: candidates = [], isLoading } = useCandidates();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set(['overdue', 'today']));
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Generate all tasks from candidates
  const allTasks = candidates.flatMap(generateTasksForCandidate)
    .filter(task => !completedTasks.has(task.id));

  // Group tasks
  const overdueTasks = allTasks.filter(t => t.isOverdue);
  const todayTasks = allTasks.filter(t => t.isDueToday);
  const tomorrowTasks = allTasks.filter(t => t.isDueTomorrow);
  const upcomingTasks = allTasks.filter(t => !t.isOverdue && !t.isDueToday && !t.isDueTomorrow);

  // Filter tasks based on selection
  const getFilteredTasks = () => {
    switch (filter) {
      case 'overdue': return overdueTasks;
      case 'today': return todayTasks;
      case 'upcoming': return [...tomorrowTasks, ...upcomingTasks];
      default: return allTasks;
    }
  };

  const filteredTasks = getFilteredTasks();

  const handleCompleteTask = (taskId: string) => {
    setCompletedTasks(prev => new Set([...prev, taskId]));
  };

  const toggleStage = (stage: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
      } else {
        next.add(stage);
      }
      return next;
    });
  };

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
          <h1 className="font-display text-3xl text-white">Tasks</h1>
          <p className="text-navy-400 mt-1">
            {allTasks.length} tasks across {candidates.filter(c =>
              !['placement_completed', 'rejected_ai', 'rejected_human', 'rejected_client', 'withdrawn', 'blacklisted', 'on_hold'].includes(c.current_status)
            ).length} active candidates
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('overdue')}
          className={`card p-4 text-left transition-colors ${filter === 'overdue' ? 'ring-2 ring-red-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{overdueTasks.length}</p>
              <p className="text-sm text-navy-400">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('today')}
          className={`card p-4 text-left transition-colors ${filter === 'today' ? 'ring-2 ring-amber-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{todayTasks.length}</p>
              <p className="text-sm text-navy-400">Due Today</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('upcoming')}
          className={`card p-4 text-left transition-colors ${filter === 'upcoming' ? 'ring-2 ring-blue-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{tomorrowTasks.length + upcomingTasks.length}</p>
              <p className="text-sm text-navy-400">Upcoming</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`card p-4 text-left transition-colors ${filter === 'all' ? 'ring-2 ring-coral-500' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-coral-500/20 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-coral-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{allTasks.length}</p>
              <p className="text-sm text-navy-400">All Tasks</p>
            </div>
          </div>
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-xl text-white mb-2">All caught up!</p>
          <p className="text-navy-400">
            {filter === 'all'
              ? 'No pending tasks for active candidates.'
              : `No ${filter} tasks.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Group by priority if showing all */}
          {filter === 'all' ? (
            <>
              {/* Overdue Section */}
              {overdueTasks.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => toggleStage('overdue')}
                    className="flex items-center gap-2 text-red-400 font-medium w-full"
                  >
                    {expandedStages.has('overdue') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <AlertCircle className="w-4 h-4" />
                    Overdue ({overdueTasks.length})
                  </button>
                  {expandedStages.has('overdue') && (
                    <div className="space-y-2 ml-6">
                      {overdueTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => handleCompleteTask(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Today Section */}
              {todayTasks.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => toggleStage('today')}
                    className="flex items-center gap-2 text-amber-400 font-medium w-full"
                  >
                    {expandedStages.has('today') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Clock className="w-4 h-4" />
                    Due Today ({todayTasks.length})
                  </button>
                  {expandedStages.has('today') && (
                    <div className="space-y-2 ml-6">
                      {todayTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => handleCompleteTask(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tomorrow Section */}
              {tomorrowTasks.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => toggleStage('tomorrow')}
                    className="flex items-center gap-2 text-blue-400 font-medium w-full"
                  >
                    {expandedStages.has('tomorrow') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Calendar className="w-4 h-4" />
                    Due Tomorrow ({tomorrowTasks.length})
                  </button>
                  {expandedStages.has('tomorrow') && (
                    <div className="space-y-2 ml-6">
                      {tomorrowTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => handleCompleteTask(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upcoming Section */}
              {upcomingTasks.length > 0 && (
                <div className="space-y-2">
                  <button
                    onClick={() => toggleStage('upcoming')}
                    className="flex items-center gap-2 text-navy-300 font-medium w-full"
                  >
                    {expandedStages.has('upcoming') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Calendar className="w-4 h-4" />
                    Upcoming ({upcomingTasks.length})
                  </button>
                  {expandedStages.has('upcoming') && (
                    <div className="space-y-2 ml-6">
                      {upcomingTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => handleCompleteTask(task.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Filtered view - show tasks directly */
            <div className="space-y-2">
              {filteredTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => handleCompleteTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
