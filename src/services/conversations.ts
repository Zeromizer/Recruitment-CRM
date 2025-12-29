import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ConversationMessage {
  id: string;
  created_at: string;
  platform: 'telegram' | 'whatsapp';
  platform_user_id: string;
  candidate_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  message_metadata: Record<string, unknown>;
}

export interface ConversationState {
  id: string;
  created_at: string;
  updated_at: string;
  platform: 'telegram' | 'whatsapp';
  platform_user_id: string;
  candidate_id: string | null;
  stage: string;
  candidate_name: string | null;
  applied_role: string | null;
  citizenship_status: string | null;
  form_completed: boolean;
  resume_received: boolean;
  experience_discussed: boolean;
  call_scheduled: boolean;
  state_data: Record<string, unknown>;
}

export interface ConversationSummary {
  platform: string;
  platform_user_id: string;
  candidate_id: string | null;
  candidate_name: string;
  username: string | null;
  stage: string;
  message_count: number;
  last_updated: string;
  applied_role: string | null;
}

// ============================================================================
// GET ALL CONVERSATIONS
// ============================================================================

export async function getConversationsList(): Promise<ConversationSummary[]> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  try {
    // Get all conversation states
    const { data: states, error: statesError } = await supabase
      .from('conversation_states')
      .select('*')
      .order('updated_at', { ascending: false });

    if (statesError) {
      console.error('Error fetching conversation states:', statesError);
      throw statesError;
    }

    // For each state, get the message count
    const summaries: ConversationSummary[] = [];

    for (const state of states || []) {
      // Get message count
      const { count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('platform', state.platform)
        .eq('platform_user_id', state.platform_user_id);

      // Try to get candidate info if linked
      let candidateName = state.candidate_name || 'Unknown';
      let username = null;

      if (state.candidate_id) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('full_name, telegram_username')
          .eq('id', state.candidate_id)
          .single();

        if (candidate) {
          candidateName = candidate.full_name || candidateName;
          username = candidate.telegram_username;
        }
      }

      summaries.push({
        platform: state.platform,
        platform_user_id: state.platform_user_id,
        candidate_id: state.candidate_id,
        candidate_name: candidateName,
        username,
        stage: state.stage || 'initial',
        message_count: count || 0,
        last_updated: state.updated_at,
        applied_role: state.applied_role,
      });
    }

    return summaries;
  } catch (error) {
    console.error('Error getting conversations list:', error);
    throw error;
  }
}

// ============================================================================
// GET CONVERSATION MESSAGES
// ============================================================================

export async function getConversationMessages(
  platform: string,
  platformUserId: string
): Promise<ConversationMessage[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching conversation messages:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// GET CONVERSATION STATE
// ============================================================================

export async function getConversationState(
  platform: string,
  platformUserId: string
): Promise<ConversationState | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('conversation_states')
    .select('*')
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('Error fetching conversation state:', error);
    throw error;
  }

  return data;
}

// ============================================================================
// DELETE CONVERSATION
// ============================================================================

export async function deleteConversation(
  platform: string,
  platformUserId: string
): Promise<{ deletedMessages: number }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Delete all messages
  const { data: deletedMessages, error: msgError } = await supabase
    .from('conversations')
    .delete()
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId)
    .select();

  if (msgError) {
    console.error('Error deleting messages:', msgError);
    throw msgError;
  }

  // Delete state
  const { error: stateError } = await supabase
    .from('conversation_states')
    .delete()
    .eq('platform', platform)
    .eq('platform_user_id', platformUserId);

  if (stateError) {
    console.error('Error deleting conversation state:', stateError);
    throw stateError;
  }

  return { deletedMessages: deletedMessages?.length || 0 };
}

// ============================================================================
// DELETE ALL CONVERSATIONS FOR A CANDIDATE
// ============================================================================

export async function deleteConversationsByCandidate(
  candidateId: string
): Promise<{ deletedMessages: number }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Delete all messages linked to this candidate
  const { data: deletedMessages, error: msgError } = await supabase
    .from('conversations')
    .delete()
    .eq('candidate_id', candidateId)
    .select();

  if (msgError) {
    console.error('Error deleting messages:', msgError);
    throw msgError;
  }

  // Delete states linked to this candidate
  const { error: stateError } = await supabase
    .from('conversation_states')
    .delete()
    .eq('candidate_id', candidateId);

  if (stateError) {
    console.error('Error deleting conversation states:', stateError);
    throw stateError;
  }

  return { deletedMessages: deletedMessages?.length || 0 };
}

// ============================================================================
// CLEAR ALL CONVERSATIONS (ADMIN)
// ============================================================================

export async function clearAllConversations(): Promise<{ deletedMessages: number; deletedStates: number }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Delete all messages
  const { data: deletedMessages, error: msgError } = await supabase
    .from('conversations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all (workaround for no WHERE clause)
    .select();

  if (msgError) {
    console.error('Error deleting all messages:', msgError);
    throw msgError;
  }

  // Delete all states
  const { data: deletedStates, error: stateError } = await supabase
    .from('conversation_states')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (stateError) {
    console.error('Error deleting all states:', stateError);
    throw stateError;
  }

  return {
    deletedMessages: deletedMessages?.length || 0,
    deletedStates: deletedStates?.length || 0,
  };
}
