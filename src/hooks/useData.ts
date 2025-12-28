import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  demoCandidates,
  demoActivities,
  demoInterviews
} from '../lib/supabase';
import type { Candidate, Activity, Interview, Task, CandidateStatus, DashboardMetrics } from '../types';
import { startOfWeek, parseISO, isSameDay } from 'date-fns';

// Candidates hooks
export function useCandidates() {
  return useQuery({
    queryKey: ['candidates'],
    queryFn: async (): Promise<Candidate[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoCandidates;
      }

      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ['candidates', id],
    queryFn: async (): Promise<Candidate | null> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoCandidates.find(c => c.id === id) || null;
      }

      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useUpdateCandidateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CandidateStatus }) => {
      if (!isSupabaseConfigured || !supabase) {
        // Update demo data in memory
        const candidateIndex = demoCandidates.findIndex(c => c.id === id);
        if (candidateIndex !== -1) {
          demoCandidates[candidateIndex] = {
            ...demoCandidates[candidateIndex],
            current_status: status,
            updated_at: new Date().toISOString(),
          };
          return demoCandidates[candidateIndex];
        }
        throw new Error('Candidate not found');
      }

      const { data, error } = await supabase
        .from('candidates')
        .update({ current_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Candidate> }) => {
      if (!isSupabaseConfigured || !supabase) {
        const candidateIndex = demoCandidates.findIndex(c => c.id === id);
        if (candidateIndex !== -1) {
          demoCandidates[candidateIndex] = {
            ...demoCandidates[candidateIndex],
            ...updates,
            updated_at: new Date().toISOString(),
          };
          return demoCandidates[candidateIndex];
        }
        throw new Error('Candidate not found');
      }

      const { data, error } = await supabase
        .from('candidates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['candidates', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (candidate: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>) => {
      if (!isSupabaseConfigured || !supabase) {
        const newCandidate: Candidate = {
          ...candidate,
          id: String(demoCandidates.length + 1 + Math.random()),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        demoCandidates.unshift(newCandidate);
        return newCandidate;
      }

      const { data, error } = await supabase
        .from('candidates')
        .insert(candidate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Activities hooks
export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async (): Promise<Activity[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoActivities;
      }

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('activity_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCandidateActivities(candidateId: string) {
  return useQuery({
    queryKey: ['activities', 'candidate', candidateId],
    queryFn: async (): Promise<Activity[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoActivities.filter(a => a.candidate_id === candidateId);
      }

      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('activity_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(candidateId),
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: Omit<Activity, 'id' | 'created_at'>) => {
      if (!isSupabaseConfigured || !supabase) {
        const newActivity: Activity = {
          ...activity,
          id: String(demoActivities.length + 1),
          created_at: new Date().toISOString(),
        };
        demoActivities.unshift(newActivity);
        return newActivity;
      }

      const { data, error } = await supabase
        .from('activities')
        .insert(activity)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

// Interviews hooks
export function useInterviews() {
  return useQuery({
    queryKey: ['interviews'],
    queryFn: async (): Promise<Interview[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoInterviews;
      }

      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .order('interview_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCandidateInterviews(candidateId: string) {
  return useQuery({
    queryKey: ['interviews', 'candidate', candidateId],
    queryFn: async (): Promise<Interview[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoInterviews.filter(i => i.candidate_id === candidateId);
      }

      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('interview_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(candidateId),
  });
}

export function useUpdateInterview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Interview> }) => {
      if (!isSupabaseConfigured || !supabase) {
        const interviewIndex = demoInterviews.findIndex(i => i.id === id);
        if (interviewIndex !== -1) {
          demoInterviews[interviewIndex] = {
            ...demoInterviews[interviewIndex],
            ...updates,
          };
          return demoInterviews[interviewIndex];
        }
        throw new Error('Interview not found');
      }

      const { data, error } = await supabase
        .from('interviews')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviews'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// Tasks hooks
const demoTasks: Task[] = [];

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async (): Promise<Task[]> => {
      if (!isSupabaseConfigured || !supabase) {
        return demoTasks;
      }

      // Fetch all tasks (including completed) so we can track completed auto-tasks
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'created_at' | 'completed' | 'completed_at'>) => {
      if (!isSupabaseConfigured || !supabase) {
        const newTask: Task = {
          ...task,
          id: `demo-${Date.now()}`,
          created_at: new Date().toISOString(),
          completed: false,
          completed_at: null,
        };
        demoTasks.push(newTask);
        return newTask;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          completed: false,
          completed_at: null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!isSupabaseConfigured || !supabase) {
        const taskIndex = demoTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          demoTasks[taskIndex] = {
            ...demoTasks[taskIndex],
            completed: true,
            completed_at: new Date().toISOString(),
          };
          return demoTasks[taskIndex];
        }
        throw new Error('Task not found');
      }

      const { data, error } = await supabase
        .from('tasks')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!isSupabaseConfigured || !supabase) {
        const taskIndex = demoTasks.findIndex(t => t.id === taskId);
        if (taskIndex !== -1) {
          demoTasks.splice(taskIndex, 1);
          return true;
        }
        throw new Error('Task not found');
      }

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Special hook for completing auto-generated tasks (creates a completed record)
export function useCompleteAutoTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: { id: string; candidate_id: string; candidate_name: string; task: string; due_date: string }) => {
      if (!isSupabaseConfigured || !supabase) {
        const newTask: Task = {
          id: task.id,
          created_at: new Date().toISOString(),
          candidate_id: task.candidate_id,
          candidate_name: task.candidate_name,
          task: task.task,
          due_date: task.due_date,
          completed: true,
          completed_at: new Date().toISOString(),
          is_auto: true,
        };
        demoTasks.push(newTask);
        return newTask;
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          id: task.id, // Use the auto-generated ID so we can track it
          candidate_id: task.candidate_id,
          candidate_name: task.candidate_name,
          task: task.task,
          due_date: task.due_date,
          completed: true,
          completed_at: new Date().toISOString(),
          is_auto: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Dashboard hooks
export function useDashboardMetrics() {
  const { data: candidates = [] } = useCandidates();
  const { data: interviews = [] } = useInterviews();

  return useQuery({
    queryKey: ['dashboard', candidates.length, interviews.length],
    queryFn: async (): Promise<DashboardMetrics> => {
      const today = new Date();
      const weekStart = startOfWeek(today);

      // Total candidates
      const totalCandidates = candidates.length;

      // New this week
      const newThisWeek = candidates.filter(c => {
        const createdAt = parseISO(c.created_at);
        return createdAt >= weekStart;
      }).length;

      // Average AI score (only for candidates with scores)
      const candidatesWithScores = candidates.filter(c => c.ai_score !== null);
      const avgAIScore = candidatesWithScores.length > 0
        ? candidatesWithScores.reduce((sum, c) => sum + (c.ai_score || 0), 0) / candidatesWithScores.length
        : 0;

      // Today's follow-ups
      const todaysFollowUps = candidates.filter(c => {
        if (!c.next_action_date) return false;
        return isSameDay(parseISO(c.next_action_date), today);
      });

      // Today's interviews
      const todaysInterviews = interviews.filter(i => {
        if (!i.interview_date) return false;
        return isSameDay(parseISO(i.interview_date), today) && i.status === 'Scheduled';
      });

      // Today's placements
      const todaysPlacements = candidates.filter(c => {
        if (!c.start_date) return false;
        return isSameDay(parseISO(c.start_date), today);
      });

      // Source breakdown
      const sourceMap = new Map<string, number>();
      candidates.forEach(c => {
        const source = c.source || 'Unknown';
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });
      const sourceBreakdown = Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);

      // Pipeline funnel
      const pipelineStages = [
        { stage: 'New/Screened', statuses: ['new_application', 'ai_screened', 'human_reviewed'] },
        { stage: 'Shortlisted', statuses: ['shortlisted'] },
        { stage: 'Submitted', statuses: ['submitted_to_client'] },
        { stage: 'Interview', statuses: ['interview_scheduled', 'interview_completed'] },
        { stage: 'Offer', statuses: ['offer_extended', 'offer_accepted'] },
        { stage: 'Placed', statuses: ['placement_started', 'placement_completed'] },
      ];

      const pipelineFunnel = pipelineStages.map(({ stage, statuses }) => ({
        stage,
        count: candidates.filter(c => statuses.includes(c.current_status)).length,
      }));

      return {
        totalCandidates,
        newThisWeek,
        avgAIScore: Math.round(avgAIScore * 10) / 10,
        todaysFollowUps,
        todaysInterviews,
        todaysPlacements,
        sourceBreakdown,
        pipelineFunnel,
      };
    },
    enabled: candidates.length > 0,
  });
}

// Search candidates
export function useSearchCandidates(searchTerm: string, filters?: {
  status?: CandidateStatus | '';
  source?: string;
  role?: string;
}) {
  const { data: candidates = [] } = useCandidates();

  return useQuery({
    queryKey: ['candidates', 'search', searchTerm, filters],
    queryFn: async (): Promise<Candidate[]> => {
      let filtered = candidates;

      // Text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(c =>
          c.full_name.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.applied_role?.toLowerCase().includes(term) ||
          c.phone?.includes(term)
        );
      }

      // Status filter
      if (filters?.status) {
        filtered = filtered.filter(c => c.current_status === filters.status);
      }

      // Source filter
      if (filters?.source) {
        filtered = filtered.filter(c => c.source === filters.source);
      }

      // Role filter
      if (filters?.role) {
        filtered = filtered.filter(c =>
          c.applied_role?.toLowerCase().includes(filters.role!.toLowerCase())
        );
      }

      return filtered;
    },
    enabled: candidates.length > 0,
  });
}

// Pipeline candidates (by stage)
export function usePipelineCandidates() {
  const { data: candidates = [] } = useCandidates();

  return useQuery({
    queryKey: ['candidates', 'pipeline'],
    queryFn: async () => {
      const stages = {
        shortlisted: candidates.filter(c => c.current_status === 'shortlisted'),
        submitted_to_client: candidates.filter(c => c.current_status === 'submitted_to_client'),
        interview_scheduled: candidates.filter(c => c.current_status === 'interview_scheduled'),
        interview_completed: candidates.filter(c => c.current_status === 'interview_completed'),
        offer_extended: candidates.filter(c => c.current_status === 'offer_extended'),
        offer_accepted: candidates.filter(c => c.current_status === 'offer_accepted'),
        placement_started: candidates.filter(c => c.current_status === 'placement_started'),
      };
      return stages;
    },
    enabled: candidates.length > 0,
  });
}

// Upcoming interviews grouped by day
export function useUpcomingInterviews() {
  const { data: interviews = [] } = useInterviews();

  return useQuery({
    queryKey: ['interviews', 'upcoming'],
    queryFn: async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const scheduled = interviews.filter(i =>
        i.status === 'Scheduled' && i.interview_date
      );

      const grouped = {
        today: scheduled.filter(i => isSameDay(parseISO(i.interview_date!), today)),
        tomorrow: scheduled.filter(i => isSameDay(parseISO(i.interview_date!), tomorrow)),
        thisWeek: scheduled.filter(i => {
          const date = parseISO(i.interview_date!);
          return date > tomorrow && date <= weekEnd;
        }),
        past: interviews.filter(i =>
          i.status === 'Completed' ||
          (i.interview_date && parseISO(i.interview_date) < today && i.status !== 'Scheduled')
        ),
      };

      return grouped;
    },
    enabled: interviews.length > 0,
  });
}

// Realtime subscription hook - automatically updates when data changes in Supabase
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // Subscribe to candidates table changes
    const candidatesChannel = supabase
      .channel('candidates-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          // Invalidate all candidate-related queries
          queryClient.invalidateQueries({ queryKey: ['candidates'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .subscribe();

    // Subscribe to activities table changes
    const activitiesChannel = supabase
      .channel('activities-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['activities'] });
        }
      )
      .subscribe();

    // Subscribe to interviews table changes
    const interviewsChannel = supabase
      .channel('interviews-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'interviews' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['interviews'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .subscribe();

    // Subscribe to tasks table changes
    const tasksChannel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      if (supabase) {
        supabase.removeChannel(candidatesChannel);
        supabase.removeChannel(activitiesChannel);
        supabase.removeChannel(interviewsChannel);
        supabase.removeChannel(tasksChannel);
      }
    };
  }, [queryClient]);
}
