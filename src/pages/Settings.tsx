import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Webhook,
  User,
  Copy,
  CheckCircle,
  AlertCircle,
  Code,
  Mail,
  RefreshCw,
  Power,
  Loader2,
} from 'lucide-react';
import { isSupabaseConfigured, DATABASE_SCHEMA_SQL } from '../lib/supabase';
import {
  isMicrosoftConfigured,
  getAuthorizationUrl,
  getStoredTokenInfo,
  disconnect as disconnectMicrosoft,
  handleOAuthCallback,
} from '../services/microsoftAuth';
import {
  isMonitoringEnabled,
  setMonitoringEnabled,
  getMonitoringStatus,
  triggerManualPoll,
  registerCallbacks,
  initializeMonitoring,
  type MonitoringStatus,
  type ProcessedEmail,
} from '../services/emailMonitoring';
import { useCreateCandidate, useCreateActivity } from '../hooks/useData';
import { formatDistanceToNow } from 'date-fns';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="btn-secondary flex items-center gap-2"
    >
      {copied ? (
        <>
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          Copy SQL
        </>
      )}
    </button>
  );
}

export default function Settings() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const webhookUrl = supabaseUrl
    ? `${supabaseUrl}/rest/v1/candidates`
    : 'Not configured';

  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus>(getMonitoringStatus());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPollingManually, setIsPollingManually] = useState(false);
  const [recentProcessed, setRecentProcessed] = useState<ProcessedEmail[]>([]);
  const [error, setError] = useState<string | null>(null);

  const createCandidate = useCreateCandidate();
  const createActivity = useCreateActivity();

  // Handle OAuth callback on mount
  useEffect(() => {
    const checkOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        setIsConnecting(true);
        try {
          await handleOAuthCallback();
          setMonitoringStatus(getMonitoringStatus());
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'OAuth failed');
        } finally {
          setIsConnecting(false);
        }
      }
    };

    checkOAuthCallback();
  }, []);

  // Handle processed email - create candidate and activity
  const handleEmailProcessed = useCallback(async (processed: ProcessedEmail) => {
    const result = processed.screeningResult;

    try {
      // Create candidate
      const newCandidate = await createCandidate.mutateAsync({
        date_received: new Date().toISOString(),
        full_name: result.candidate_name,
        email: result.candidate_email,
        phone: result.candidate_phone,
        source: 'Email',
        applied_role: result.job_matched,
        ai_score: result.score,
        ai_category: result.recommendation,
        citizenship_status: result.citizenship_status,
        ai_summary: result.summary,
        ai_reasoning: '',
        resume_url: '',
        current_status: result.recommendation === 'Rejected' ? 'rejected_ai' : 'ai_screened',
        assigned_recruiter: null,
        matched_roles: [result.job_matched],
        client_submitted_to: null,
        submission_date: null,
        interview_date: null,
        interview_outcome: null,
        offer_date: null,
        offer_status: null,
        start_date: null,
        contract_end_date: null,
        hourly_rate: null,
        bill_rate: null,
        placement_status: null,
        notes: `Auto-processed from email: ${processed.subject}`,
        last_contact_date: null,
        next_action: result.recommendation === 'Rejected' ? null : 'Review application',
        next_action_date: result.recommendation === 'Rejected' ? null : new Date().toISOString().split('T')[0],
      });

      // Create activity
      await createActivity.mutateAsync({
        candidate_id: newCandidate.id,
        candidate_name: result.candidate_name,
        activity_date: new Date().toISOString(),
        activity_type: 'AI Screening',
        direction: 'Inbound',
        channel: 'Email',
        subject: `Application from ${processed.fromEmail}`,
        details: `Auto-processed email application. Resume: ${processed.attachmentName}. AI Score: ${result.score}/10. ${result.summary}`,
        related_job: result.job_matched,
        related_client: null,
        outcome: result.recommendation === 'Rejected' ? 'Rejected' : 'Pending Review',
        follow_up_required: result.recommendation !== 'Rejected',
        follow_up_date: result.recommendation === 'Rejected' ? null : new Date().toISOString().split('T')[0],
        follow_up_action: result.recommendation === 'Rejected' ? null : 'Review application',
        logged_by: 'System',
      });

      // Add to recent processed list
      setRecentProcessed(prev => [processed, ...prev].slice(0, 5));
    } catch (err) {
      console.error('Failed to create candidate from email:', err);
      setError(err instanceof Error ? err.message : 'Failed to create candidate');
    }
  }, [createCandidate, createActivity]);

  // Register callbacks and initialize monitoring
  useEffect(() => {
    registerCallbacks({
      onEmailProcessed: handleEmailProcessed,
      onStatusChange: setMonitoringStatus,
      onError: (err) => setError(err.message),
    });

    initializeMonitoring();

    // Update status periodically
    const interval = setInterval(() => {
      setMonitoringStatus(getMonitoringStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, [handleEmailProcessed]);

  const handleConnectOutlook = () => {
    if (!isMicrosoftConfigured()) {
      setError('Microsoft OAuth is not configured. Please add VITE_MICROSOFT_CLIENT_ID to your environment.');
      return;
    }

    window.location.href = getAuthorizationUrl();
  };

  const handleDisconnect = () => {
    disconnectMicrosoft();
    setMonitoringEnabled(false);
    setMonitoringStatus(getMonitoringStatus());
  };

  const handleToggleMonitoring = () => {
    setMonitoringEnabled(!isMonitoringEnabled());
    setMonitoringStatus(getMonitoringStatus());
  };

  const handleManualPoll = async () => {
    setIsPollingManually(true);
    try {
      await triggerManualPoll();
    } finally {
      setIsPollingManually(false);
      setMonitoringStatus(getMonitoringStatus());
    }
  };

  const tokenInfo = getStoredTokenInfo();

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">
          Configure your CRM and view integration details
        </p>
      </div>

      {/* Email Monitoring */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Mail className="w-5 h-5 text-blue-500" />
          Email Monitoring
        </h2>
        <p className="text-slate-500 mb-6">
          Automatically monitor your Outlook inbox for job applications and process them with AI screening.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-500 hover:text-red-700 mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-4">
              {monitoringStatus.isConnected ? (
                <>
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-medium">Connected to Outlook</p>
                    <p className="text-sm text-slate-500">{tokenInfo?.email}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-6 h-6 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-medium">Not Connected</p>
                    <p className="text-sm text-slate-500">Connect your Outlook account to enable auto-monitoring</p>
                  </div>
                </>
              )}
            </div>

            {monitoringStatus.isConnected ? (
              <button
                onClick={handleDisconnect}
                className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnectOutlook}
                className="btn-primary flex items-center gap-2"
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Connect Outlook
                  </>
                )}
              </button>
            )}
          </div>

          {/* Monitoring Toggle */}
          {monitoringStatus.isConnected && (
            <>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    monitoringStatus.isEnabled ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}>
                    <Power className={`w-6 h-6 ${
                      monitoringStatus.isEnabled ? 'text-emerald-600' : 'text-slate-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-slate-800 font-medium">Auto-Monitoring</p>
                    <p className="text-sm text-slate-500">
                      {monitoringStatus.isEnabled
                        ? 'Checking inbox every 30 seconds'
                        : 'Disabled - emails won\'t be processed automatically'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleToggleMonitoring}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    monitoringStatus.isEnabled ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                      monitoringStatus.isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Status Info */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-2xl font-bold text-slate-800">{monitoringStatus.processedCount}</p>
                  <p className="text-sm text-slate-500">Emails Processed</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-lg font-medium text-slate-800">
                    {monitoringStatus.lastCheck
                      ? formatDistanceToNow(new Date(monitoringStatus.lastCheck), { addSuffix: true })
                      : 'Never'}
                  </p>
                  <p className="text-sm text-slate-500">Last Check</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 text-center">
                  <p className="text-lg font-medium text-slate-800 flex items-center justify-center gap-2">
                    {monitoringStatus.isPolling ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-cgp-red" />
                        Checking...
                      </>
                    ) : monitoringStatus.isEnabled ? (
                      <span className="text-emerald-600">Active</span>
                    ) : (
                      <span className="text-slate-400">Paused</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">Status</p>
                </div>
              </div>

              {/* Manual Poll Button */}
              <button
                onClick={handleManualPoll}
                disabled={isPollingManually || monitoringStatus.isPolling}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isPollingManually ? 'animate-spin' : ''}`} />
                {isPollingManually ? 'Checking...' : 'Check Now'}
              </button>

              {/* Recent Processed Emails */}
              {recentProcessed.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-600 mb-2">Recently Processed</p>
                  <div className="space-y-2">
                    {recentProcessed.map((processed, index) => (
                      <div key={index} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                        <div className="flex items-center justify-between">
                          <p className="text-slate-800 font-medium">{processed.screeningResult.candidate_name}</p>
                          <span className={`badge ${
                            processed.screeningResult.recommendation === 'Top Candidate' ? 'badge-success' :
                            processed.screeningResult.recommendation === 'Review' ? 'badge-warning' : 'badge-error'
                          }`}>
                            {processed.screeningResult.score}/10
                          </span>
                        </div>
                        <p className="text-slate-500 truncate">{processed.subject}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Configuration Note */}
        {!isMicrosoftConfigured() && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-600 mb-3">
              To enable email monitoring, add Microsoft OAuth credentials to your <code className="text-cgp-red">.env</code> file:
            </p>
            <pre className="text-sm font-mono bg-white p-4 rounded-lg overflow-x-auto border border-slate-200">
              <code className="text-slate-700">
{`VITE_MICROSOFT_CLIENT_ID=your-client-id
VITE_MICROSOFT_TENANT_ID=common`}
              </code>
            </pre>
            <p className="text-xs text-slate-400 mt-3">
              Register an app at{' '}
              <a
                href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cgp-red hover:underline"
              >
                Azure Portal
              </a>{' '}
              with redirect URI: <code className="text-cgp-red">{window.location.origin}/auth/callback</code>
            </p>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-500" />
          Supabase Connection
        </h2>
        <div className="flex items-center gap-4">
          {isSupabaseConfigured ? (
            <>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-slate-800 font-medium">Connected</p>
                <p className="text-sm text-slate-500">
                  Database is configured and ready
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-slate-800 font-medium">Using Demo Data</p>
                <p className="text-sm text-slate-500">
                  Configure environment variables to connect to Supabase
                </p>
              </div>
            </>
          )}
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-sm text-slate-600 mb-3">
              To connect to Supabase, create a <code className="text-cgp-red">.env</code> file
              with the following variables:
            </p>
            <pre className="text-sm font-mono bg-white p-4 rounded-lg overflow-x-auto border border-slate-200">
              <code className="text-slate-700">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Power Automate Webhook */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Webhook className="w-5 h-5 text-purple-500" />
          Power Automate Integration
        </h2>
        <p className="text-slate-500 mb-4">
          Use this endpoint to POST new candidates from your Power Automate workflow:
        </p>
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
          <code className="text-sm font-mono text-cgp-red flex-1 break-all">
            POST {webhookUrl}
          </code>
          {isSupabaseConfigured && (
            <button
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-6">
          <p className="text-sm text-slate-500 mb-3">Required headers:</p>
          <pre className="text-sm font-mono bg-white p-4 rounded-lg overflow-x-auto border border-slate-200">
            <code className="text-slate-700">
{`apikey: {your-supabase-anon-key}
Authorization: Bearer {your-supabase-anon-key}
Content-Type: application/json
Prefer: return=representation`}
            </code>
          </pre>
        </div>

        <div className="mt-6">
          <p className="text-sm text-slate-500 mb-3">Example request body:</p>
          <pre className="text-sm font-mono bg-white p-4 rounded-lg overflow-x-auto border border-slate-200">
            <code className="text-slate-700">
{`{
  "full_name": "John Doe",
  "email": "john.doe@email.com",
  "phone": "+65 9123 4567",
  "source": "Seek",
  "applied_role": "Software Engineer",
  "ai_score": 8,
  "ai_category": "Top Candidate",
  "citizenship_status": "SC",
  "ai_summary": "Strong candidate with relevant experience",
  "ai_reasoning": "Detailed analysis from Claude...",
  "resume_url": "https://example.com/resume.pdf",
  "current_status": "ai_screened"
}`}
            </code>
          </pre>
        </div>
      </div>

      {/* Database Schema */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-500" />
            Database Schema
          </h2>
          <CopyButton text={DATABASE_SCHEMA_SQL} />
        </div>
        <p className="text-slate-500 mb-4">
          Run this SQL in your Supabase SQL Editor to create the required tables:
        </p>
        <pre className="text-xs font-mono bg-white p-4 rounded-lg overflow-x-auto max-h-96 border border-slate-200">
          <code className="text-slate-700">{DATABASE_SCHEMA_SQL}</code>
        </pre>
      </div>

      {/* User Profile */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-cgp-red" />
          User Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-cgp-red rounded-full flex items-center justify-center shadow-md">
            <span className="text-xl font-medium text-white">S</span>
          </div>
          <div>
            <p className="text-slate-800 font-medium text-lg">Shawn</p>
            <p className="text-slate-500">CGP Personnel</p>
            <p className="text-sm text-slate-400 mt-1">Recruiter</p>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">About</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Application</dt>
            <dd className="text-slate-700">CGP Personnel CRM</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Version</dt>
            <dd className="text-slate-700">1.0.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tech Stack</dt>
            <dd className="text-slate-700">React + TypeScript + Supabase</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Mode</dt>
            <dd className="text-slate-700">
              {isSupabaseConfigured ? 'Production' : 'Demo Mode'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
