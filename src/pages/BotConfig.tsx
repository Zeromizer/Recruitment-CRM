import { useState, useEffect } from 'react';
import {
  Bot,
  Briefcase,
  Building2,
  MessageSquare,
  Target,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Save,
  RefreshCw,
  X,
  MapPin,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  Copy,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import {
  getJobPosts,
  createJobPost,
  updateJobPost,
  toggleJobActive,
  deleteJobPost,
  getCompanyProfile,
  saveCompanyProfile,
  getCommunicationStyle,
  saveCommunicationStyle,
  getObjectives,
  saveObjectives,
  seedDefaultKnowledgebase,
} from '../services/knowledgebase';
import type { JobPost, CompanyProfile, JobFormData } from '../types/botConfig';
import { isSupabaseConfigured } from '../lib/supabase';

type TabType = 'jobs' | 'company' | 'style' | 'objectives' | 'prompt';

// Tab configuration
const tabs: { id: TabType; name: string; icon: typeof Briefcase }[] = [
  { id: 'jobs', name: 'Job Posts', icon: Briefcase },
  { id: 'company', name: 'Company Profile', icon: Building2 },
  { id: 'style', name: 'Communication Style', icon: MessageSquare },
  { id: 'objectives', name: 'Objectives', icon: Target },
  { id: 'prompt', name: 'System Prompt', icon: Eye },
];

// Empty job form data
const emptyJobForm: JobFormData = {
  key: '',
  title: '',
  is_active: true,
  keywords: '',
  salary: '',
  location: '',
  work_type: '',
  day_shift: '',
  overnight_shift: '',
  responsibilities: '',
  requirements: '',
  experience_questions: '',
  key_skills: '',
  citizenship_required: 'Any',
  notes: '',
};

export default function BotConfig() {
  const [activeTab, setActiveTab] = useState<TabType>('jobs');
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [communicationStyle, setCommunicationStyle] = useState<{
    tone: string;
    language: string;
    formality: string;
    emoji_usage: string;
    response_length: string;
    message_delay: string;
    custom_phrases: string;
  } | null>(null);
  const [objectives, setObjectives] = useState<{
    primary_goal: string;
    secondary_goals: string;
    conversation_starters: string;
    closing_messages: string;
    escalation_triggers: string;
    success_criteria: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Job form state
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobFormData>(emptyJobForm);

  // Image import state
  const [showImageImportModal, setShowImageImportModal] = useState(false);
  const [importingImage, setImportingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Clear messages after 3 seconds
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  async function loadData() {
    if (!isSupabaseConfigured) {
      setError('Supabase not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [jobsData, profileData, styleData, objectivesData] = await Promise.all([
        getJobPosts(),
        getCompanyProfile(),
        getCommunicationStyle(),
        getObjectives(),
      ]);
      setJobs(jobsData);
      setCompanyProfile(profileData);
      setCommunicationStyle(styleData as typeof communicationStyle);
      setObjectives(objectivesData as typeof objectives);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // JOB HANDLERS
  // ============================================================================

  function openAddJobModal() {
    setEditingJob(null);
    setJobForm(emptyJobForm);
    setShowJobModal(true);
  }

  function openEditJobModal(job: JobPost) {
    setEditingJob(job.key);
    setJobForm({
      key: job.key,
      title: job.title,
      is_active: job.is_active,
      keywords: job.keywords?.join(', ') || '',
      salary: job.salary || '',
      location: job.location || '',
      work_type: job.work_type || '',
      day_shift: job.shifts?.day || '',
      overnight_shift: job.shifts?.overnight || '',
      responsibilities: job.responsibilities?.join('\n') || '',
      requirements: job.requirements?.join('\n') || '',
      experience_questions: job.experience_questions?.join('\n') || '',
      key_skills: job.key_skills?.join(', ') || '',
      citizenship_required: job.citizenship_required || 'Any',
      notes: job.notes || '',
    });
    setShowJobModal(true);
  }

  async function handleSaveJob() {
    if (!jobForm.key || !jobForm.title) {
      setError('Job key and title are required');
      return;
    }

    setSaving(true);
    try {
      const jobData: Omit<JobPost, 'id' | 'created_at' | 'updated_at'> = {
        key: jobForm.key.toLowerCase().replace(/\s+/g, '_'),
        title: jobForm.title,
        is_active: jobForm.is_active,
        keywords: jobForm.keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        salary: jobForm.salary || undefined,
        location: jobForm.location || undefined,
        work_type: jobForm.work_type || undefined,
        shifts: (jobForm.day_shift || jobForm.overnight_shift) ? {
          day: jobForm.day_shift || undefined,
          overnight: jobForm.overnight_shift || undefined,
        } : undefined,
        responsibilities: jobForm.responsibilities.split('\n').map(r => r.trim()).filter(Boolean),
        requirements: jobForm.requirements.split('\n').map(r => r.trim()).filter(Boolean),
        experience_questions: jobForm.experience_questions.split('\n').map(q => q.trim()).filter(Boolean),
        key_skills: jobForm.key_skills.split(',').map(s => s.trim()).filter(Boolean),
        citizenship_required: jobForm.citizenship_required !== 'Any' ? jobForm.citizenship_required : undefined,
        notes: jobForm.notes || undefined,
      };

      if (editingJob) {
        await updateJobPost(editingJob, jobData);
        setSuccess('Job updated successfully');
      } else {
        await createJobPost(jobData);
        setSuccess('Job created successfully');
      }

      setShowJobModal(false);
      loadData();
    } catch (err) {
      console.error('Error saving job:', err);
      setError('Failed to save job');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleJob(key: string, currentStatus: boolean) {
    try {
      await toggleJobActive(key, !currentStatus);
      setJobs(jobs.map(j => j.key === key ? { ...j, is_active: !currentStatus } : j));
      setSuccess(`Job ${!currentStatus ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Error toggling job:', err);
      setError('Failed to toggle job status');
    }
  }

  async function handleDeleteJob(key: string) {
    if (!confirm(`Are you sure you want to delete the job "${key}"?`)) return;

    try {
      await deleteJobPost(key);
      setJobs(jobs.filter(j => j.key !== key));
      setSuccess('Job deleted');
    } catch (err) {
      console.error('Error deleting job:', err);
      setError('Failed to delete job');
    }
  }

  // ============================================================================
  // COMPANY PROFILE HANDLERS
  // ============================================================================

  async function handleSaveCompanyProfile() {
    if (!companyProfile) return;

    setSaving(true);
    try {
      await saveCompanyProfile(companyProfile);
      setSuccess('Company profile saved');
    } catch (err) {
      console.error('Error saving company profile:', err);
      setError('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // SEED DATA
  // ============================================================================

  async function handleSeedData() {
    if (!confirm('This will add default configuration data. Continue?')) return;

    setSaving(true);
    try {
      await seedDefaultKnowledgebase();
      await loadData();
      setSuccess('Default data seeded successfully');
    } catch (err) {
      console.error('Error seeding data:', err);
      setError('Failed to seed data');
    } finally {
      setSaving(false);
    }
  }

  // ============================================================================
  // IMAGE IMPORT
  // ============================================================================

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Convert to base64 for preview and API
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function processImageWithAI() {
    if (!imagePreview) return;

    setImportingImage(true);
    setError(null);

    try {
      // Get API key from localStorage or prompt user
      let apiKey = localStorage.getItem('anthropic_api_key');
      if (!apiKey) {
        apiKey = prompt('Enter your Anthropic API key to use AI image scanning.\n\nThis will be stored locally in your browser.');
        if (!apiKey) {
          setError('API key required for image scanning');
          setImportingImage(false);
          return;
        }
        localStorage.setItem('anthropic_api_key', apiKey);
      }

      // Extract base64 data from data URL
      const base64Data = imagePreview.split(',')[1];
      const mediaType = imagePreview.split(';')[0].split(':')[1];

      // Call Claude API with vision
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Extract job posting details from this image and return ONLY a JSON object with these fields (use empty string if not found):
{
  "title": "job title",
  "salary": "salary range",
  "location": "work location",
  "work_type": "full-time/part-time/contract",
  "day_shift": "day shift hours if mentioned",
  "overnight_shift": "night shift hours if mentioned",
  "responsibilities": "comma-separated list of responsibilities",
  "requirements": "comma-separated list of requirements",
  "keywords": "comma-separated keywords for matching (job type, industry, skills)",
  "citizenship_required": "SC for Singaporean only, PR for PR/Citizen, Any for no restriction",
  "notes": "any other important notes"
}

Return ONLY the JSON, no explanation.`,
              },
            ],
          }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          localStorage.removeItem('anthropic_api_key');
          throw new Error('Invalid API key. Please try again.');
        }
        throw new Error(errorData.error?.message || 'Failed to process image');
      }

      const data = await response.json();
      const content = data.content[0]?.text;

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse job details from image');
      }

      const jobData = JSON.parse(jsonMatch[0]);

      // Generate a key from the title
      const key = jobData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 30);

      // Pre-fill the job form
      setJobForm({
        key: key || '',
        title: jobData.title || '',
        is_active: true,
        keywords: jobData.keywords || '',
        salary: jobData.salary || '',
        location: jobData.location || '',
        work_type: jobData.work_type || '',
        day_shift: jobData.day_shift || '',
        overnight_shift: jobData.overnight_shift || '',
        responsibilities: jobData.responsibilities || '',
        requirements: jobData.requirements || '',
        experience_questions: '',
        key_skills: '',
        citizenship_required: (jobData.citizenship_required as 'SC' | 'PR' | 'Any') || 'Any',
        notes: jobData.notes || '',
      });

      // Close image modal and open job form
      setShowImageImportModal(false);
      setImagePreview(null);
      setEditingJob(null);
      setShowJobModal(true);
      setSuccess('Job details extracted! Review and save.');

    } catch (err) {
      console.error('Error processing image:', err);
      setError(err instanceof Error ? err.message : 'Failed to process image');
    } finally {
      setImportingImage(false);
    }
  }

  // ============================================================================
  // GENERATE SYSTEM PROMPT
  // ============================================================================

  function generateSystemPrompt(): string {
    const parts: string[] = [];

    // Identity section
    const recruiterName = companyProfile?.recruiter_name || 'Ai Wei';
    const companyName = companyProfile?.name || 'CGP';
    const fullName = companyProfile?.full_name || 'CGP Singapore';

    parts.push(`You are ${recruiterName}, a recruiter at ${fullName} (${companyName}).`);
    parts.push('');
    parts.push('## YOUR ROLE');
    parts.push(`You're helping candidates find suitable part-time and contract positions in Singapore. You work for ${companyName}, a staffing agency.`);
    parts.push('');

    // Communication style section
    if (communicationStyle) {
      parts.push('## HOW TO COMMUNICATE');

      const toneDescriptions: Record<string, string> = {
        'friendly': 'friendly and warm, like texting a helpful friend',
        'professional': 'professional and courteous',
        'enthusiastic': 'enthusiastic and energetic',
        'empathetic': 'empathetic and understanding',
        'direct': 'direct and efficient, getting straight to the point',
      };
      parts.push(`- Be ${toneDescriptions[communicationStyle.tone] || communicationStyle.tone}`);

      if (communicationStyle.language === 'singlish') {
        parts.push("- Use Singlish: 'lah', 'lor', 'can' etc. to sound more local");
      } else if (communicationStyle.language === 'bilingual') {
        parts.push('- Mix English with Chinese phrases where appropriate');
      }

      if (communicationStyle.formality === 'casual') {
        parts.push("- Use casual language: 'u' instead of 'you', 'ur' instead of 'your', 'cos' instead of 'because'");
      } else if (communicationStyle.formality === 'semi-formal') {
        parts.push('- Keep language professional but approachable');
      } else {
        parts.push('- Use formal, corporate language');
      }

      if (communicationStyle.emoji_usage === 'none') {
        parts.push('- Do not use emojis');
      } else if (communicationStyle.emoji_usage === 'minimal') {
        parts.push('- Use emojis sparingly, only when appropriate');
      } else if (communicationStyle.emoji_usage === 'moderate') {
        parts.push('- Use emojis moderately to add warmth');
      } else {
        parts.push('- Feel free to use emojis frequently');
      }

      parts.push("- Match the candidate's energy - if they're brief, be brief. If chatty, be more conversational");
      parts.push('');

      parts.push('## MESSAGE FORMAT');
      if (communicationStyle.response_length === 'concise') {
        parts.push("- Keep responses short and to the point (1-2 sentences)");
        parts.push("- Use '---' to split into multiple short messages");
      } else if (communicationStyle.response_length === 'balanced') {
        parts.push('- Use medium-length responses (2-3 sentences)');
      } else {
        parts.push('- Provide detailed, comprehensive responses when helpful');
      }
      parts.push('- Less is more - don\'t over-explain');
      parts.push('');

      if (communicationStyle.custom_phrases) {
        parts.push('## SUGGESTED PHRASES');
        communicationStyle.custom_phrases.split('\n').forEach(phrase => {
          if (phrase.trim()) {
            parts.push(`- "${phrase.trim()}"`);
          }
        });
        parts.push('');
      }
    }

    // Objectives section
    if (objectives) {
      parts.push('## YOUR OBJECTIVES');
      parts.push(`**Primary Goal:** ${objectives.primary_goal}`);
      parts.push('');

      if (objectives.secondary_goals) {
        parts.push('**Secondary Goals:**');
        objectives.secondary_goals.split('\n').forEach(goal => {
          if (goal.trim()) parts.push(`- ${goal.trim()}`);
        });
        parts.push('');
      }

      if (objectives.success_criteria) {
        parts.push('**Success Criteria:**');
        objectives.success_criteria.split('\n').forEach(criterion => {
          if (criterion.trim()) parts.push(`- ${criterion.trim()}`);
        });
        parts.push('');
      }

      if (objectives.escalation_triggers) {
        parts.push('**When to Escalate to Human:**');
        objectives.escalation_triggers.split('\n').forEach(trigger => {
          if (trigger.trim()) parts.push(`- ${trigger.trim()}`);
        });
        parts.push('');
      }

      if (objectives.closing_messages) {
        parts.push('**Closing Messages (use when wrapping up):**');
        objectives.closing_messages.split('\n').forEach(msg => {
          if (msg.trim()) parts.push(`- "${msg.trim()}"`);
        });
        parts.push('');
      }
    }

    // Company knowledge section
    parts.push('## WHAT YOU KNOW');
    if (companyProfile) {
      parts.push(`- Company: ${companyProfile.description || 'A recruitment agency in Singapore'}`);
      if (companyProfile.ea_licence) parts.push(`- EA Licence: ${companyProfile.ea_licence}`);
      if (companyProfile.application_form_url) {
        parts.push(`- Application form: ${companyProfile.application_form_url} (select '${recruiterName}' as consultant)`);
      }
      if (companyProfile.contact?.website) parts.push(`- Website: ${companyProfile.contact.website}`);
    }
    parts.push('');

    // Active jobs section
    const activeJobs = jobs.filter(job => job.is_active);
    if (activeJobs.length > 0) {
      parts.push('## CURRENT JOB OPENINGS');
      activeJobs.forEach(job => {
        parts.push(`**${job.title}**`);
        if (job.salary) parts.push(`- Pay: ${job.salary}`);
        if (job.location) parts.push(`- Location: ${job.location}`);
        if (job.work_type) parts.push(`- Type: ${job.work_type}`);
        if (job.shifts?.day || job.shifts?.overnight) {
          parts.push(`- Shifts: Day (${job.shifts?.day || 'TBD'}) or Overnight (${job.shifts?.overnight || 'TBD'})`);
        }
        if (job.requirements && job.requirements.length > 0) {
          parts.push(`- Requirements: ${job.requirements.join(', ')}`);
        }
        if (job.citizenship_required === 'SC') {
          parts.push('- **IMPORTANT: Singaporeans Only**');
        } else if (job.citizenship_required === 'PR') {
          parts.push('- **Requires: Singapore PR or Citizen**');
        }
        if (job.notes) parts.push(`- Notes: ${job.notes}`);
        parts.push('');
      });
    } else {
      parts.push('## CURRENT OPENINGS');
      parts.push('- No specific openings at the moment, but collect their info for future opportunities');
      parts.push('');
    }

    // Things to avoid
    parts.push("## DON'T");
    parts.push('- Repeat information they already told you');
    parts.push("- Ask for things they've already provided (form/resume)");
    parts.push('- Be overly enthusiastic with exclamation marks');
    parts.push("- Promise to call them - just say you'll be in touch if shortlisted");
    parts.push('- Send very long messages - keep it casual and brief');

    return parts.join('\n');
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-cgp-red" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cgp-red/10 rounded-lg">
            <Bot className="w-6 h-6 text-cgp-red" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Bot Configuration</h1>
            <p className="text-sm text-slate-500">Manage your chatbot's knowledge and behavior</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSeedData}
            disabled={saving}
            className="px-3 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {jobs.length === 0 && !companyProfile ? 'Seed Default Data' : 'Reset to Defaults'}
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-cgp-red text-cgp-red'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        {/* Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Job Posts</h2>
                <p className="text-sm text-slate-500">Manage available positions. Toggle to enable/disable jobs for the bot.</p>
              </div>
              <button
                onClick={() => setShowImageImportModal(true)}
                className="px-4 py-2 text-sm font-medium text-cgp-red border border-cgp-red rounded-lg hover:bg-cgp-red/5 flex items-center gap-2"
              >
                <ImagePlus className="w-4 h-4" />
                Import from Image
              </button>
              <button
                onClick={openAddJobModal}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Job
              </button>
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No jobs configured yet.</p>
                <p className="text-sm">Click "Add Job" or "Seed Default Data" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <div
                    key={job.key}
                    className={`p-4 border rounded-lg transition-colors ${
                      job.is_active ? 'border-green-200 bg-green-50/50' : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-slate-800">{job.title}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            job.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}>
                            {job.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {job.citizenship_required === 'SC' && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                              SC Only
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-3">
                          {job.salary && (
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4 text-slate-400" />
                              {job.salary}
                            </div>
                          )}
                          {job.location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-slate-400" />
                              {job.location.length > 40 ? job.location.substring(0, 40) + '...' : job.location}
                            </div>
                          )}
                          {job.work_type && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-slate-400" />
                              {job.work_type}
                            </div>
                          )}
                        </div>

                        {job.keywords && job.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {job.keywords.slice(0, 5).map((keyword) => (
                              <span key={keyword} className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                                {keyword}
                              </span>
                            ))}
                            {job.keywords.length > 5 && (
                              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">
                                +{job.keywords.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleToggleJob(job.key, job.is_active)}
                          className={`p-2 rounded-lg transition-colors ${
                            job.is_active
                              ? 'text-green-600 hover:bg-green-100'
                              : 'text-slate-400 hover:bg-slate-100'
                          }`}
                          title={job.is_active ? 'Disable job' : 'Enable job'}
                        >
                          {job.is_active ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditJobModal(job)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                          title="Edit job"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job.key)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Company Profile Tab */}
        {activeTab === 'company' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Company Profile</h2>
                <p className="text-sm text-slate-500">Configure company information the bot will use.</p>
              </div>
              <button
                onClick={handleSaveCompanyProfile}
                disabled={saving || !companyProfile}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            {!companyProfile ? (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No company profile configured.</p>
                <p className="text-sm">Click "Seed Default Data" to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                    <input
                      type="text"
                      value={companyProfile.name}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={companyProfile.full_name}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tagline</label>
                    <input
                      type="text"
                      value={companyProfile.tagline}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, tagline: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      value={companyProfile.description}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">EA Licence</label>
                    <input
                      type="text"
                      value={companyProfile.ea_licence}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, ea_licence: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Recruiter Name</label>
                    <input
                      type="text"
                      value={companyProfile.recruiter_name}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, recruiter_name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Application Form URL</label>
                    <input
                      type="text"
                      value={companyProfile.application_form_url}
                      onChange={(e) => setCompanyProfile({ ...companyProfile, application_form_url: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                    <input
                      type="text"
                      value={companyProfile.contact?.website || ''}
                      onChange={(e) => setCompanyProfile({
                        ...companyProfile,
                        contact: { ...companyProfile.contact, website: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instagram</label>
                    <input
                      type="text"
                      value={companyProfile.social_media?.instagram || ''}
                      onChange={(e) => setCompanyProfile({
                        ...companyProfile,
                        social_media: { ...companyProfile.social_media, instagram: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
                    <input
                      type="text"
                      value={companyProfile.social_media?.linkedin || ''}
                      onChange={(e) => setCompanyProfile({
                        ...companyProfile,
                        social_media: { ...companyProfile.social_media, linkedin: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Communication Style Tab */}
        {activeTab === 'style' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Communication Style</h2>
                <p className="text-sm text-slate-500">Configure how the bot communicates with candidates.</p>
              </div>
              <button
                onClick={async () => {
                  if (!communicationStyle) return;
                  setSaving(true);
                  try {
                    await saveCommunicationStyle(communicationStyle);
                    setSuccess('Communication style saved successfully');
                  } catch (err) {
                    console.error('Error saving style:', err);
                    setError('Failed to save communication style');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !communicationStyle}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>

            {!communicationStyle ? (
              <div className="text-center py-12 text-slate-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No communication style configured.</p>
                <p className="text-sm">Click "Reset to Defaults" to get started.</p>
                <button
                  onClick={() => setCommunicationStyle({
                    tone: 'friendly',
                    language: 'english',
                    formality: 'casual',
                    emoji_usage: 'minimal',
                    response_length: 'concise',
                    message_delay: 'normal',
                    custom_phrases: '',
                  })}
                  className="mt-4 px-4 py-2 text-sm font-medium text-cgp-red border border-cgp-red rounded-lg hover:bg-cgp-red/5"
                >
                  Create Style Configuration
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tone</label>
                    <select
                      value={communicationStyle.tone}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, tone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="friendly">Friendly & Warm</option>
                      <option value="professional">Professional</option>
                      <option value="enthusiastic">Enthusiastic & Energetic</option>
                      <option value="empathetic">Empathetic & Understanding</option>
                      <option value="direct">Direct & Efficient</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Sets the overall feeling of the conversation</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                    <select
                      value={communicationStyle.language}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, language: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="english">English</option>
                      <option value="singlish">Singlish (Singapore English)</option>
                      <option value="bilingual">Bilingual (English + Chinese)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Primary language for bot responses</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Formality Level</label>
                    <select
                      value={communicationStyle.formality}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, formality: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="casual">Casual (like texting a friend)</option>
                      <option value="semi-formal">Semi-formal (professional but approachable)</option>
                      <option value="formal">Formal (corporate language)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">How formal should the bot sound</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Emoji Usage</label>
                    <select
                      value={communicationStyle.emoji_usage}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, emoji_usage: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="none">None</option>
                      <option value="minimal">Minimal (occasional)</option>
                      <option value="moderate">Moderate</option>
                      <option value="frequent">Frequent</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">How often to use emojis in messages</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Response Length</label>
                    <select
                      value={communicationStyle.response_length}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, response_length: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="concise">Concise (short, to the point)</option>
                      <option value="balanced">Balanced (medium length)</option>
                      <option value="detailed">Detailed (comprehensive)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Preferred length of bot responses</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Message Delay</label>
                    <select
                      value={communicationStyle.message_delay || 'normal'}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, message_delay: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    >
                      <option value="instant">Instant (no delay)</option>
                      <option value="fast">Fast (0.5-1s between messages)</option>
                      <option value="normal">Normal (1.5-3s between messages)</option>
                      <option value="slow">Slow (3-5s between messages)</option>
                      <option value="very_slow">Very Slow (5-8s between messages)</option>
                    </select>
                    <p className="text-xs text-slate-400 mt-1">Delay between bot messages (more natural feel)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Custom Phrases / Greetings</label>
                    <textarea
                      value={communicationStyle.custom_phrases}
                      onChange={(e) => setCommunicationStyle({ ...communicationStyle, custom_phrases: e.target.value })}
                      placeholder="Enter custom phrases the bot should use, one per line. E.g.:&#10;Hello! Thanks for reaching out to CGP!&#10;Sounds great, let me help you with that!&#10;Welcome to CGP Singapore!"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                      rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">Custom phrases the bot can use (one per line)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Objectives Tab */}
        {activeTab === 'objectives' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Conversation Objectives</h2>
                <p className="text-sm text-slate-500">Set goals and triggers for bot conversations.</p>
              </div>
              <button
                onClick={async () => {
                  if (!objectives) return;
                  setSaving(true);
                  try {
                    await saveObjectives(objectives);
                    setSuccess('Objectives saved successfully');
                  } catch (err) {
                    console.error('Error saving objectives:', err);
                    setError('Failed to save objectives');
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving || !objectives}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>

            {!objectives ? (
              <div className="text-center py-12 text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No objectives configured.</p>
                <p className="text-sm">Click "Reset to Defaults" to get started.</p>
                <button
                  onClick={() => setObjectives({
                    primary_goal: 'Qualify candidates for job openings and collect their contact information for follow-up',
                    secondary_goals: 'Answer questions about job requirements\nProvide company information\nSchedule interviews when appropriate',
                    conversation_starters: 'Hi! I\'m the CGP recruitment assistant. Are you looking for a new job opportunity?\nHello! Thanks for reaching out. How can I help you today?\nWelcome to CGP! Are you interested in any of our current job openings?',
                    closing_messages: 'Great! I\'ve noted your details. Our recruiter will be in touch soon!\nThank you for your interest! We\'ll review your information and get back to you.\nThanks for chatting! Look out for a call or message from our team.',
                    escalation_triggers: 'Candidate requests to speak to a human\nComplex salary negotiation questions\nComplaints or negative feedback\nLegal or contract-related questions',
                    success_criteria: 'Candidate provides name and phone number\nCandidate expresses interest in specific job\nCandidate agrees to interview or follow-up call',
                  })}
                  className="mt-4 px-4 py-2 text-sm font-medium text-cgp-red border border-cgp-red rounded-lg hover:bg-cgp-red/5"
                >
                  Create Objectives Configuration
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Goal</label>
                  <textarea
                    value={objectives.primary_goal}
                    onChange={(e) => setObjectives({ ...objectives, primary_goal: e.target.value })}
                    placeholder="What is the main objective of each conversation?"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    rows={2}
                  />
                  <p className="text-xs text-slate-400 mt-1">The main purpose of bot conversations</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Goals</label>
                    <textarea
                      value={objectives.secondary_goals}
                      onChange={(e) => setObjectives({ ...objectives, secondary_goals: e.target.value })}
                      placeholder="Other things the bot should try to accomplish (one per line)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                      rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">Additional objectives (one per line)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Success Criteria</label>
                    <textarea
                      value={objectives.success_criteria}
                      onChange={(e) => setObjectives({ ...objectives, success_criteria: e.target.value })}
                      placeholder="How do we know a conversation was successful? (one per line)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                      rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">What counts as a successful conversation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Conversation Starters</label>
                    <textarea
                      value={objectives.conversation_starters}
                      onChange={(e) => setObjectives({ ...objectives, conversation_starters: e.target.value })}
                      placeholder="Opening messages the bot can use (one per line)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                      rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">How the bot starts conversations</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Closing Messages</label>
                    <textarea
                      value={objectives.closing_messages}
                      onChange={(e) => setObjectives({ ...objectives, closing_messages: e.target.value })}
                      placeholder="How the bot should end conversations (one per line)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                      rows={4}
                    />
                    <p className="text-xs text-slate-400 mt-1">How the bot ends conversations</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Escalation Triggers</label>
                  <textarea
                    value={objectives.escalation_triggers}
                    onChange={(e) => setObjectives({ ...objectives, escalation_triggers: e.target.value })}
                    placeholder="When should the bot hand off to a human? (one per line)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                    rows={3}
                  />
                  <p className="text-xs text-slate-400 mt-1">Situations that require human intervention</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System Prompt Preview Tab */}
        {activeTab === 'prompt' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">System Prompt Preview</h2>
                <p className="text-sm text-slate-500">This is what the AI bot sees when responding to candidates.</p>
              </div>
              <button
                onClick={() => {
                  const prompt = generateSystemPrompt();
                  navigator.clipboard.writeText(prompt);
                  setSuccess('System prompt copied to clipboard!');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-[600px]">
              <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono">
                {generateSystemPrompt()}
              </pre>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">How this prompt is built:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Identity:</strong> From Company Profile (recruiter name, company name)</li>
                <li>• <strong>Communication rules:</strong> From Communication Style tab</li>
                <li>• <strong>Job listings:</strong> Only active jobs from Job Posts tab</li>
                <li>• <strong>Goals:</strong> From Objectives tab</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Job Modal */}
      {showJobModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingJob ? 'Edit Job Post' : 'Add New Job Post'}
              </h2>
              <button
                onClick={() => setShowJobModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Job Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobForm.key}
                    onChange={(e) => setJobForm({ ...jobForm, key: e.target.value })}
                    disabled={!!editingJob}
                    placeholder="e.g., warehouse_packer"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red disabled:bg-slate-100"
                  />
                  <p className="text-xs text-slate-500 mt-1">Unique identifier (no spaces)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={jobForm.title}
                    onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })}
                    placeholder="e.g., Warehouse Operations/Packer"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={jobForm.is_active}
                    onChange={(e) => setJobForm({ ...jobForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-cgp-red border-slate-300 rounded focus:ring-cgp-red"
                  />
                  <span className="text-sm font-medium text-slate-700">Active (visible to bot)</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Keywords</label>
                <input
                  type="text"
                  value={jobForm.keywords}
                  onChange={(e) => setJobForm({ ...jobForm, keywords: e.target.value })}
                  placeholder="warehouse, packer, logistics, jurong (comma-separated)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
                <p className="text-xs text-slate-500 mt-1">Keywords that trigger this job in conversation</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salary</label>
                  <input
                    type="text"
                    value={jobForm.salary}
                    onChange={(e) => setJobForm({ ...jobForm, salary: e.target.value })}
                    placeholder="e.g., $2,200 - $2,700/month"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Work Type</label>
                  <input
                    type="text"
                    value={jobForm.work_type}
                    onChange={(e) => setJobForm({ ...jobForm, work_type: e.target.value })}
                    placeholder="e.g., Full-time, 6 days/week"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input
                  type="text"
                  value={jobForm.location}
                  onChange={(e) => setJobForm({ ...jobForm, location: e.target.value })}
                  placeholder="e.g., 6 Fishery Port Road, Singapore 619747 (Jurong Port)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Day Shift Hours</label>
                  <input
                    type="text"
                    value={jobForm.day_shift}
                    onChange={(e) => setJobForm({ ...jobForm, day_shift: e.target.value })}
                    placeholder="e.g., 10am to 7pm"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Night/Overnight Shift</label>
                  <input
                    type="text"
                    value={jobForm.overnight_shift}
                    onChange={(e) => setJobForm({ ...jobForm, overnight_shift: e.target.value })}
                    placeholder="e.g., 9pm to 6am"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Citizenship Requirement</label>
                <select
                  value={jobForm.citizenship_required}
                  onChange={(e) => setJobForm({ ...jobForm, citizenship_required: e.target.value as 'SC' | 'PR' | 'Any' })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                >
                  <option value="Any">Any (SC/PR/Foreigner)</option>
                  <option value="SC">Singaporeans Only</option>
                  <option value="PR">SC or PR Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requirements</label>
                <textarea
                  value={jobForm.requirements}
                  onChange={(e) => setJobForm({ ...jobForm, requirements: e.target.value })}
                  rows={3}
                  placeholder="One requirement per line, e.g.:&#10;Singaporeans Only&#10;Basic numerical conversion knowledge"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Experience Questions</label>
                <textarea
                  value={jobForm.experience_questions}
                  onChange={(e) => setJobForm({ ...jobForm, experience_questions: e.target.value })}
                  rows={3}
                  placeholder="Questions to ask candidates, one per line:&#10;are u a singaporean?&#10;do u have warehouse experience?"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Key Skills</label>
                <input
                  type="text"
                  value={jobForm.key_skills}
                  onChange={(e) => setJobForm({ ...jobForm, key_skills: e.target.value })}
                  placeholder="Basic math, Physical stamina, Attention to detail (comma-separated)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (for bot context)</label>
                <textarea
                  value={jobForm.notes}
                  onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes for the bot..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setShowJobModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveJob}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Import Modal */}
      {showImageImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Import Job from Image</h2>
              <button
                onClick={() => {
                  setShowImageImportModal(false);
                  setImagePreview(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                Upload an image of a job posting and AI will extract the details automatically.
              </p>

              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-cgp-red hover:bg-red-50/50 transition-colors">
                  <ImagePlus className="w-10 h-10 text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">Click to upload image</span>
                  <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Job posting preview"
                      className="w-full max-h-64 object-contain rounded-lg border border-slate-200"
                    />
                    <button
                      onClick={() => setImagePreview(null)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                <strong>Note:</strong> This feature uses Claude AI to analyze the image.
                You'll need an Anthropic API key (will be stored locally in your browser).
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowImageImportModal(false);
                  setImagePreview(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={processImageWithAI}
                disabled={!imagePreview || importingImage}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 disabled:opacity-50 flex items-center gap-2"
              >
                {importingImage ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Extract Job Details
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
