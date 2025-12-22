import { useState } from 'react';
import {
  Database,
  Webhook,
  User,
  Copy,
  CheckCircle,
  AlertCircle,
  Code,
} from 'lucide-react';
import { isSupabaseConfigured, DATABASE_SCHEMA_SQL } from '../lib/supabase';

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
          <CheckCircle className="w-4 h-4 text-emerald-400" />
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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl text-white">Settings</h1>
        <p className="text-navy-400 mt-1">
          Configure your CRM and view integration details
        </p>
      </div>

      {/* Connection Status */}
      <div className="card p-6">
        <h2 className="font-display text-lg text-white flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-blue-400" />
          Supabase Connection
        </h2>
        <div className="flex items-center gap-4">
          {isSupabaseConfigured ? (
            <>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-medium">Connected</p>
                <p className="text-sm text-navy-400">
                  Database is configured and ready
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-white font-medium">Using Demo Data</p>
                <p className="text-sm text-navy-400">
                  Configure environment variables to connect to Supabase
                </p>
              </div>
            </>
          )}
        </div>

        {!isSupabaseConfigured && (
          <div className="mt-6 p-4 bg-navy-800/50 rounded-lg">
            <p className="text-sm text-navy-300 mb-3">
              To connect to Supabase, create a <code className="text-coral-400">.env</code> file
              with the following variables:
            </p>
            <pre className="text-sm font-mono bg-navy-900 p-4 rounded-lg overflow-x-auto">
              <code className="text-navy-200">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
              </code>
            </pre>
          </div>
        )}
      </div>

      {/* Power Automate Webhook */}
      <div className="card p-6">
        <h2 className="font-display text-lg text-white flex items-center gap-2 mb-4">
          <Webhook className="w-5 h-5 text-purple-400" />
          Power Automate Integration
        </h2>
        <p className="text-navy-400 mb-4">
          Use this endpoint to POST new candidates from your Power Automate workflow:
        </p>
        <div className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg">
          <code className="text-sm font-mono text-coral-400 flex-1 break-all">
            POST {webhookUrl}
          </code>
          {isSupabaseConfigured && (
            <button
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="text-navy-400 hover:text-white transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-6">
          <p className="text-sm text-navy-400 mb-3">Required headers:</p>
          <pre className="text-sm font-mono bg-navy-900 p-4 rounded-lg overflow-x-auto">
            <code className="text-navy-200">
{`apikey: {your-supabase-anon-key}
Authorization: Bearer {your-supabase-anon-key}
Content-Type: application/json
Prefer: return=representation`}
            </code>
          </pre>
        </div>

        <div className="mt-6">
          <p className="text-sm text-navy-400 mb-3">Example request body:</p>
          <pre className="text-sm font-mono bg-navy-900 p-4 rounded-lg overflow-x-auto">
            <code className="text-navy-200">
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
          <h2 className="font-display text-lg text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-400" />
            Database Schema
          </h2>
          <CopyButton text={DATABASE_SCHEMA_SQL} />
        </div>
        <p className="text-navy-400 mb-4">
          Run this SQL in your Supabase SQL Editor to create the required tables:
        </p>
        <pre className="text-xs font-mono bg-navy-900 p-4 rounded-lg overflow-x-auto max-h-96">
          <code className="text-navy-200">{DATABASE_SCHEMA_SQL}</code>
        </pre>
      </div>

      {/* User Profile */}
      <div className="card p-6">
        <h2 className="font-display text-lg text-white flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-coral-400" />
          User Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-navy-700 rounded-full flex items-center justify-center">
            <span className="text-xl font-medium text-white">S</span>
          </div>
          <div>
            <p className="text-white font-medium text-lg">Shawn</p>
            <p className="text-navy-400">Cornerstone Global Partners</p>
            <p className="text-sm text-navy-500 mt-1">Recruiter</p>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="card p-6">
        <h2 className="font-display text-lg text-white mb-4">About</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-navy-400">Application</dt>
            <dd className="text-navy-200">Recruiter CRM</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-400">Version</dt>
            <dd className="text-navy-200">1.0.0</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-400">Tech Stack</dt>
            <dd className="text-navy-200">React + TypeScript + Supabase</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-navy-400">Mode</dt>
            <dd className="text-navy-200">
              {isSupabaseConfigured ? 'Production' : 'Demo Mode'}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
