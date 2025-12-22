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
  Star,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { useCandidates } from '../hooks/useData';
import type { Candidate } from '../types';

interface TaskItem {
  id: string;
  candidate: Candidate;
  task: string;
  dueDate: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
}

function generateTasksForCandidate(candidate: Candidate): TaskItem[] {
  // Only create tasks for top candidates with score 8+
  if (!candidate.ai_score || candidate.ai_score < 8) {
    return [];
  }

  // Skip if already beyond initial review stage
  if (!['new_application', 'ai_screened'].includes(candidate.current_status)) {
    return [];
  }

  const dueDate = candidate.next_action_date
    ? parseISO(candidate.next_action_date)
    : candidate.created_at
      ? parseISO(candidate.created_at)
      : new Date();

  const dueDateStr = format(dueDate, 'yyyy-MM-dd');

  return [{
    id: `${candidate.id}-review-call`,
    candidate,
    task: 'Review and call',
    dueDate: dueDateStr,
    isOverdue: isPast(dueDate) && !isToday(dueDate),
    isDueToday: isToday(dueDate),
    isDueTomorrow: isTomorrow(dueDate),
  }];
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
          <div className="flex items-center gap-2">
            <p className="text-white font-medium">{task.task}</p>
            <span className="flex items-center gap-1 text-amber-400 text-sm">
              <Star className="w-4 h-4 fill-amber-400" />
              {task.candidate.ai_score}/10
            </span>
          </div>

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
            <span className="badge badge-success text-xs">Top Candidate</span>

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
              className="p-2 text-navy-400 hover:text-green-400 hover:bg-navy-700 rounded-lg transition-colors"
              title="Call candidate"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {task.candidate.email && (
            <a
              href={`mailto:${task.candidate.email}`}
              className="p-2 text-navy-400 hover:text-white hover:bg-navy-700 rounded-lg transition-colors"
              title="Email candidate"
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
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Generate tasks only for top candidates (score 8+)
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
            {allTasks.length} top candidate{allTasks.length !== 1 ? 's' : ''} to review and call
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
              ? 'No top candidates (score 8+) pending review.'
              : `No ${filter} tasks.`}
          </p>
        </div>
      ) : (
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
  );
}
