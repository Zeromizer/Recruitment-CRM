import { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  ExternalLink,
  Download,
  Settings,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  type JobScoringCriteria,
  type GoogleSheetConfig,
  parseGoogleSheetUrl,
  getGoogleSheetConfig,
  saveGoogleSheetConfig,
  fetchJobScoringFromGoogleSheet,
  downloadCSV,
} from '../services/googleSheets';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function JobScoring() {
  const [criteria, setCriteria] = useState<JobScoringCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Google Sheet config
  const [showConfig, setShowConfig] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig | null>(null);

  useEffect(() => {
    loadData();
    const config = getGoogleSheetConfig();
    if (config) {
      setSheetConfig(config);
    }
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
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase not configured');
      }

      // Load from Supabase
      const { data, error: dbError } = await supabase
        .from('job_scoring')
        .select('*')
        .order('created_at', { ascending: true });

      if (dbError) throw dbError;

      // Map snake_case from Supabase to camelCase for component
      const mappedCriteria = (data || []).map((item: any) => ({
        id: item.id,
        jobTitle: item.job_title,
        requirements: item.requirements,
        scoringGuide: item.scoring_guide,
        updated_at: item.updated_at,
      }));

      setCriteria(mappedCriteria);
    } catch (err) {
      console.error('Error loading job scoring:', err);
      setError(err instanceof Error ? err.message : 'Failed to load job scoring criteria');
    } finally {
      setLoading(false);
    }
  }

  async function saveToDatabase() {
    setSaving(true);
    setError(null);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase not configured');
      }

      // Delete all existing and insert new
      await supabase.from('job_scoring').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: insertError } = await supabase
        .from('job_scoring')
        .insert(
          criteria.map(c => ({
            job_title: c.jobTitle,
            requirements: c.requirements,
            scoring_guide: c.scoringGuide,
          }))
        );

      if (insertError) throw insertError;

      setSuccess('Saved to database successfully');
      await loadData();
    } catch (err) {
      console.error('Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function syncFromGoogleSheet() {
    if (!sheetConfig) {
      setError('Please configure Google Sheet first');
      setShowConfig(true);
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const data = await fetchJobScoringFromGoogleSheet(
        sheetConfig.spreadsheetId,
        sheetConfig.range
      );

      setCriteria(data);
      setSuccess(`Synced ${data.length} jobs from Google Sheet`);
    } catch (err) {
      console.error('Error syncing from Google Sheet:', err);
      setError(err instanceof Error ? err.message : 'Failed to sync from Google Sheet');
    } finally {
      setSyncing(false);
    }
  }

  function handleConfigSave() {
    const spreadsheetId = parseGoogleSheetUrl(sheetUrl);

    if (!spreadsheetId) {
      setError('Invalid Google Sheets URL');
      return;
    }

    const config: GoogleSheetConfig = {
      spreadsheetId,
      sheetName: 'Sheet1',
      range: 'Sheet1!A:C',
    };

    saveGoogleSheetConfig(config);
    setSheetConfig(config);
    setShowConfig(false);
    setSuccess('Google Sheet configuration saved');
  }

  function addNewCriteria() {
    const newCriteria: JobScoringCriteria = {
      id: `new-${Date.now()}`,
      jobTitle: '',
      requirements: '',
      scoringGuide: '',
    };
    setCriteria([...criteria, newCriteria]);
  }

  function updateCriteria(id: string, field: keyof JobScoringCriteria, value: string) {
    setCriteria(
      criteria.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  }

  function deleteCriteria(id: string) {
    if (confirm('Are you sure you want to delete this job scoring criteria?')) {
      setCriteria(criteria.filter(c => c.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-cgp-red" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Job Scoring Criteria</h1>
              <p className="text-sm text-slate-500">Manage AI screening criteria synced with Google Sheets</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sheetConfig && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${sheetConfig.spreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Open Sheet
              </a>
            )}
            <button
              onClick={() => setShowConfig(true)}
              className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Configure
            </button>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Main Content */}
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={syncFromGoogleSheet}
                disabled={syncing || !sheetConfig}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync from Google Sheet
              </button>
              <button
                onClick={addNewCriteria}
                className="px-4 py-2 text-sm font-medium text-cgp-red border border-cgp-red rounded-lg hover:bg-cgp-red/5 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Job
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadCSV(criteria)}
                className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={saveToDatabase}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save to Database'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-cgp-red" />
              </div>
            ) : criteria.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No job scoring criteria yet.</p>
                <p className="text-sm">Sync from Google Sheet or add manually.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-1/5">
                      Job Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-2/5">
                      Requirements
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-2/5">
                      Scoring Guide
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {criteria.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.jobTitle}
                          onChange={(e) => updateCriteria(item.id!, 'jobTitle', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                          placeholder="Job title..."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.requirements}
                          onChange={(e) => updateCriteria(item.id!, 'requirements', e.target.value)}
                          rows={4}
                          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                          placeholder="Requirements..."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={item.scoringGuide}
                          onChange={(e) => updateCriteria(item.id!, 'scoringGuide', e.target.value)}
                          rows={4}
                          className="w-full px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-cgp-red/20 focus:border-cgp-red"
                          placeholder="Scoring guide..."
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => deleteCriteria(item.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Google Sheet Config Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg m-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Google Sheet Configuration</h2>
              <button
                onClick={() => setShowConfig(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Google Sheet URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cgp-red focus:border-cgp-red"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Make sure the sheet is publicly readable or shared with your API service account
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-600">
                <strong>Setup Instructions:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Open your Google Sheet</li>
                  <li>Click Share → Get link → Anyone with the link can view</li>
                  <li>Copy the URL and paste above</li>
                  <li>Make sure columns are: A=Job Title, B=Requirements, C=Scoring Guide</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfigSave}
                className="px-4 py-2 text-sm font-medium text-white bg-cgp-red rounded-lg hover:bg-cgp-red/90"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
