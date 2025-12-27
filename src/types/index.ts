// Candidate status values
export type CandidateStatus =
  | 'new_application'
  | 'ai_screened'
  | 'human_reviewed'
  | 'shortlisted'
  | 'submitted_to_client'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_extended'
  | 'offer_accepted'
  | 'placement_started'
  | 'placement_completed'
  | 'on_hold'
  | 'withdrawn'
  | 'rejected_ai'
  | 'rejected_human'
  | 'rejected_client'
  | 'blacklisted';

// AI category
export type AICategory = 'Top Candidate' | 'Review' | 'Rejected';

// Citizenship status
export type CitizenshipStatus = 'SC' | 'PR' | 'Not Identified' | 'Foreign';

// Interview outcome
export type InterviewOutcome = 'Passed' | 'Failed' | 'Pending' | 'No Show';

// Call outcome - what happened during the call
export type CallOutcome =
  | 'Shortlisted'           // Candidate is good, prepare resume for client
  | 'Rejected'              // Not suitable for the role
  | 'Follow-up Required'    // Need to call back (more info needed, candidate busy, etc.)
  | 'No Answer'             // Didn't pick up
  | 'Wrong Number'          // Contact details incorrect
  | 'Not Interested'        // Candidate declined opportunity
  | 'On Hold'               // Candidate interested but not available now
  | 'Voicemail Left';       // Left a message

// Call outcome labels for display
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  'Shortlisted': 'Shortlisted - Prepare Resume',
  'Rejected': 'Rejected - Not Suitable',
  'Follow-up Required': 'Follow-up Required',
  'No Answer': 'No Answer',
  'Wrong Number': 'Wrong Number',
  'Not Interested': 'Not Interested',
  'On Hold': 'On Hold - Call Back Later',
  'Voicemail Left': 'Voicemail Left',
};

// Call outcome colors for UI
export const CALL_OUTCOME_COLORS: Record<CallOutcome, { bg: string; text: string; border: string }> = {
  'Shortlisted': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  'Rejected': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  'Follow-up Required': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  'No Answer': { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
  'Wrong Number': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'Not Interested': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  'On Hold': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  'Voicemail Left': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
};

// Offer status
export type OfferStatus = 'Pending' | 'Accepted' | 'Declined' | 'Negotiating';

// Placement status
export type PlacementStatus = 'Active' | 'Completed' | 'Terminated Early';

// Activity direction
export type ActivityDirection = 'Inbound' | 'Outbound' | 'Internal';

// Activity channel
export type ActivityChannel = 'Email' | 'Phone' | 'WhatsApp' | 'In-Person' | 'Portal' | 'System';

// Interview type
export type InterviewType = 'Phone' | 'Video' | 'In-Person' | 'Assessment Center';

// Interview round
export type InterviewRound = '1st' | '2nd' | '3rd' | 'Final' | 'Assessment';

// Interview status
export type InterviewStatus = 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';

// Source
export type CandidateSource = 'Seek' | 'FastJobs' | 'Indeed' | 'LinkedIn' | 'Direct' | 'Referral' | 'Email' | 'WhatsApp' | 'Telegram';

export const SOURCE_OPTIONS: CandidateSource[] = [
  'Seek',
  'FastJobs',
  'Indeed',
  'LinkedIn',
  'Direct',
  'Referral',
  'Email',
  'WhatsApp',
  'Telegram',
];

export interface Candidate {
  id: string;
  created_at: string;
  updated_at: string;
  date_received: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: CandidateSource | string | null;
  applied_role: string | null;
  ai_score: number | null;
  ai_category: AICategory | null;
  citizenship_status: CitizenshipStatus | null;
  ai_summary: string | null;
  ai_reasoning: string | null;
  resume_url: string | null;
  current_status: CandidateStatus;
  assigned_recruiter: string | null;
  matched_roles: string[] | null;
  client_submitted_to: string | null;
  submission_date: string | null;
  interview_date: string | null;
  interview_outcome: InterviewOutcome | null;
  offer_date: string | null;
  offer_status: OfferStatus | null;
  start_date: string | null;
  contract_end_date: string | null;
  hourly_rate: number | null;
  bill_rate: number | null;
  placement_status: PlacementStatus | null;
  notes: string | null;
  last_contact_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
}

export interface Activity {
  id: string;
  created_at: string;
  candidate_id: string | null;
  candidate_name: string | null;
  activity_date: string;
  activity_type: string;
  direction: ActivityDirection | null;
  channel: ActivityChannel | null;
  subject: string | null;
  details: string | null;
  related_job: string | null;
  related_client: string | null;
  outcome: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_action: string | null;
  logged_by: string | null;
}

export interface Interview {
  id: string;
  created_at: string;
  candidate_id: string | null;
  candidate_name: string | null;
  client_company: string | null;
  job_role: string | null;
  interview_round: InterviewRound | null;
  interview_type: InterviewType | null;
  interview_date: string | null;
  interview_time: string | null;
  duration_minutes: number;
  location: string | null;
  interviewer_name: string | null;
  interviewer_title: string | null;
  prep_notes_sent: boolean;
  candidate_confirmed: boolean;
  status: InterviewStatus;
  outcome: InterviewOutcome | null;
  client_feedback: string | null;
  candidate_feedback: string | null;
  next_steps: string | null;
  notes: string | null;
}

// Pipeline stages for Kanban view
export const PIPELINE_STAGES = [
  'shortlisted',
  'submitted_to_client',
  'interview_scheduled',
  'interview_completed',
  'offer_extended',
  'offer_accepted',
  'placement_started',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];

// Status display labels
export const STATUS_LABELS: Record<CandidateStatus, string> = {
  new_application: 'New Application',
  ai_screened: 'AI Screened',
  human_reviewed: 'Human Reviewed',
  shortlisted: 'Shortlisted',
  submitted_to_client: 'Submitted to Client',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  offer_extended: 'Offer Extended',
  offer_accepted: 'Offer Accepted',
  placement_started: 'Placement Started',
  placement_completed: 'Placement Completed',
  on_hold: 'On Hold',
  withdrawn: 'Withdrawn',
  rejected_ai: 'Rejected (AI)',
  rejected_human: 'Rejected (Human)',
  rejected_client: 'Rejected (Client)',
  blacklisted: 'Blacklisted',
};

// Pipeline stage labels
export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  shortlisted: 'Shortlisted',
  submitted_to_client: 'Submitted',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Done',
  offer_extended: 'Offer',
  offer_accepted: 'Accepted',
  placement_started: 'Placed',
};

// Dashboard metrics
export interface DashboardMetrics {
  totalCandidates: number;
  newThisWeek: number;
  avgAIScore: number;
  todaysFollowUps: Candidate[];
  todaysInterviews: Interview[];
  todaysPlacements: Candidate[];
  sourceBreakdown: { source: string; count: number }[];
  pipelineFunnel: { stage: string; count: number }[];
}
