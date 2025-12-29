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
} from 'lucide-react';
import {
  getJobPosts,
  createJobPost,
  updateJobPost,
  toggleJobActive,
  deleteJobPost,
  getCompanyProfile,
  saveCompanyProfile,
  seedDefaultKnowledgebase,
} from '../services/knowledgebase';
import type { JobPost, CompanyProfile, JobFormData } from '../types/botConfig';
import { isSupabaseConfigured } from '../lib/supabase';

type TabType = 'jobs' | 'company' | 'style' | 'objectives';

// Tab configuration
const tabs: { id: TabType; name: string; icon: typeof Briefcase }[] = [
  { id: 'jobs', name: 'Job Posts', icon: Briefcase },
  { id: 'company', name: 'Company Profile', icon: Building2 },
  { id: 'style', name: 'Communication Style', icon: MessageSquare },
  { id: 'objectives', name: 'Objectives', icon: Target },
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Job form state
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobFormData>(emptyJobForm);

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
      const [jobsData, profileData] = await Promise.all([
        getJobPosts(),
        getCompanyProfile(),
      ]);
      setJobs(jobsData);
      setCompanyProfile(profileData);
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
          <div className="p-6">
            <div className="text-center py-12 text-slate-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <h3 className="font-medium text-slate-700 mb-2">Communication Style</h3>
              <p className="text-sm">Configure how the bot communicates with candidates.</p>
              <p className="text-sm mt-2 text-slate-400">Coming soon...</p>
            </div>
          </div>
        )}

        {/* Objectives Tab */}
        {activeTab === 'objectives' && (
          <div className="p-6">
            <div className="text-center py-12 text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <h3 className="font-medium text-slate-700 mb-2">Conversation Objectives</h3>
              <p className="text-sm">Set goals and triggers for bot conversations.</p>
              <p className="text-sm mt-2 text-slate-400">Coming soon...</p>
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
    </div>
  );
}
