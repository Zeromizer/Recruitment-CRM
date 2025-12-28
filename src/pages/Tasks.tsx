import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Calendar,
  Phone,
  Mail,
  FileCheck,
  Briefcase,
  AlertCircle,
  Star,
  Plus,
  X,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import { useCandidates } from '../hooks/useData';
import type { Candidate } from '../types';

interface TaskItem {
  id: string;
  candidate: Candidate;
  task: string;
  dueDate: string;
  isOverdue: boolean;
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isManual?: boolean;
}

interface ManualTask {
  id: string;
  candidateId: string;
  task: string;
  dueDate: string;
}

// Load manual tasks from localStorage
function loadManualTasks(): ManualTask[] {
  try {
    const saved = localStorage.getItem('recruiter-crm-tasks');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// Save manual tasks to localStorage
function saveManualTasks(tasks: ManualTask[]) {
  localStorage.setItem('recruiter-crm-tasks', JSON.stringify(tasks));
}

// Load completed task IDs from localStorage
function loadCompletedTasks(): Set<string> {
  try {
    const saved = localStorage.getItem('recruiter-crm-completed-tasks');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

// Save completed task IDs to localStorage
function saveCompletedTasks(tasks: Set<string>) {
  localStorage.setItem('recruiter-crm-completed-tasks', JSON.stringify([...tasks]));
}

function generateAutoTasks(candidate: Candidate): TaskItem[] {
  // Only create tasks for Top Candidates (based on AI screening category)
  if (candidate.ai_category !== 'Top Candidate') {
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

function convertManualTask(manualTask: ManualTask, candidates: Candidate[]): TaskItem | null {
  const candidate = candidates.find(c => c.id === manualTask.candidateId);
  if (!candidate) return null;

  const dueDate = parseISO(manualTask.dueDate);

  return {
    id: manualTask.id,
    candidate,
    task: manualTask.task,
    dueDate: manualTask.dueDate,
    isOverdue: isPast(dueDate) && !isToday(dueDate),
    isDueToday: isToday(dueDate),
    isDueTomorrow: isTomorrow(dueDate),
    isManual: true,
  };
}

function TaskCard({ task, onComplete }: { task: TaskItem; onComplete: () => void }) {
  const priorityClass = task.isOverdue
    ? 'border-l-red-500 bg-red-50'
    : task.isDueToday
      ? 'border-l-amber-500 bg-amber-50'
      : task.isDueTomorrow
        ? 'border-l-blue-500 bg-blue-50'
        : 'border-l-slate-300';

  return (
    <div className={`card p-4 border-l-4 ${priorityClass} hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onComplete}
          className="mt-0.5 text-slate-400 hover:text-emerald-500 transition-colors"
          title="Mark as complete"
        >
          <Circle className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-slate-800 font-medium">{task.task}</p>
            {task.candidate.ai_score && task.candidate.ai_score >= 8 && (
              <span className="flex items-center gap-1 text-amber-600 text-sm">
                <Star className="w-4 h-4 fill-amber-400" />
                {task.candidate.ai_score}/10
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-2 text-sm">
            <Link
              to={`/candidates/${task.candidate.id}`}
              className="flex items-center gap-1 text-cgp-red hover:text-cgp-red-dark"
            >
              <User className="w-4 h-4" />
              {task.candidate.full_name}
            </Link>

            <span className="flex items-center gap-1 text-slate-500">
              <Briefcase className="w-4 h-4" />
              {task.candidate.applied_role || 'No role'}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            {task.isManual ? (
              <span className="badge badge-info text-xs">Manual Task</span>
            ) : (
              <span className="badge badge-success text-xs">Top Candidate</span>
            )}

            <span className={`flex items-center gap-1 text-xs ${
              task.isOverdue ? 'text-red-600' :
              task.isDueToday ? 'text-amber-600' :
              task.isDueTomorrow ? 'text-blue-600' : 'text-slate-500'
            }`}>
              <Clock className="w-3 h-3" />
              {task.isOverdue ? 'Overdue' :
               task.isDueToday ? 'Due today' :
               task.isDueTomorrow ? 'Due tomorrow' :
               format(parseISO(task.dueDate), 'MMM d')}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2">
          {task.candidate.phone && (
            <a
              href={`tel:${task.candidate.phone}`}
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Call candidate"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {task.candidate.email && (
            <a
              href={`mailto:${task.candidate.email}`}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(loadCompletedTasks);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>(loadManualTasks);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ candidateId: '', task: '', dueDate: '' });

  // Generate auto tasks for top candidates
  const autoTasks = candidates.flatMap(generateAutoTasks);

  // Convert manual tasks to TaskItems
  const manualTaskItems = manualTasks
    .map(mt => convertManualTask(mt, candidates))
    .filter((t): t is TaskItem => t !== null);

  // Combine all tasks and filter completed
  const allTasks = [...autoTasks, ...manualTaskItems]
    .filter(task => !completedTasks.has(task.id));

  // Group tasks by priority
  const overdueTasks = allTasks.filter(t => t.isOverdue);
  const todayTasks = allTasks.filter(t => t.isDueToday);
  const tomorrowTasks = allTasks.filter(t => t.isDueTomorrow);
  const upcomingTasks = allTasks.filter(t => !t.isOverdue && !t.isDueToday && !t.isDueTomorrow);

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
    const newCompletedTasks = new Set([...completedTasks, taskId]);
    setCompletedTasks(newCompletedTasks);
    saveCompletedTasks(newCompletedTasks);
    // Also remove from manual tasks if it's a manual task
    const updatedManualTasks = manualTasks.filter(t => t.id !== taskId);
    setManualTasks(updatedManualTasks);
    saveManualTasks(updatedManualTasks);
  };

  const handleAddTask = () => {
    if (!newTask.candidateId || !newTask.task || !newTask.dueDate) {
      alert('Please fill in all fields');
      return;
    }

    const task: ManualTask = {
      id: `manual-${Date.now()}`,
      candidateId: newTask.candidateId,
      task: newTask.task,
      dueDate: newTask.dueDate,
    };

    const updatedTasks = [...manualTasks, task];
    setManualTasks(updatedTasks);
    saveManualTasks(updatedTasks);
    setNewTask({ candidateId: '', task: '', dueDate: '' });
    setShowAddModal(false);
  };

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
          <h1 className="text-3xl font-bold text-slate-800">Tasks</h1>
          <p className="text-slate-500 mt-1">
            {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} to complete
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('overdue')}
          className={`card p-4 text-left transition-all ${filter === 'overdue' ? 'ring-2 ring-red-500 shadow-md' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{overdueTasks.length}</p>
              <p className="text-sm text-slate-500">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('today')}
          className={`card p-4 text-left transition-all ${filter === 'today' ? 'ring-2 ring-amber-500 shadow-md' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{todayTasks.length}</p>
              <p className="text-sm text-slate-500">Due Today</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('upcoming')}
          className={`card p-4 text-left transition-all ${filter === 'upcoming' ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{tomorrowTasks.length + upcomingTasks.length}</p>
              <p className="text-sm text-slate-500">Upcoming</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`card p-4 text-left transition-all ${filter === 'all' ? 'ring-2 ring-cgp-red shadow-md' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cgp-red/10 rounded-lg flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-cgp-red" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-800">{allTasks.length}</p>
              <p className="text-sm text-slate-500">All Tasks</p>
            </div>
          </div>
        </button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-xl text-slate-800 mb-2">All caught up!</p>
          <p className="text-slate-500">
            {filter === 'all'
              ? 'No pending tasks. Click "Add Task" to create one.'
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

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-800">Add Task</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Candidate Select */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Candidate <span className="text-cgp-red">*</span>
                </label>
                <select
                  value={newTask.candidateId}
                  onChange={(e) => setNewTask({ ...newTask, candidateId: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select a candidate</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} - {c.applied_role || 'No role'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Description */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Task <span className="text-cgp-red">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.task}
                  onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Follow up on interview"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm text-slate-500 mb-1">
                  Due Date <span className="text-cgp-red">*</span>
                </label>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="input w-full"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTask}
                className="btn-primary"
              >
                Add Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
