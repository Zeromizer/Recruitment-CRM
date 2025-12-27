/**
 * Application Constants
 *
 * Centralized configuration for API endpoints, service settings,
 * and other application-wide constants.
 */

// =============================================================================
// API Endpoints
// =============================================================================

/**
 * External API base URLs
 */
export const API_ENDPOINTS = {
  ANTHROPIC: 'https://api.anthropic.com/v1/messages',
  MICROSOFT_GRAPH: 'https://graph.microsoft.com/v1.0',
  GOOGLE_SHEETS: 'https://sheets.googleapis.com/v4/spreadsheets',
} as const;

/**
 * Microsoft Graph API endpoints
 */
export const GRAPH_ENDPOINTS = {
  ME: '/me',
  MESSAGES: '/me/messages',
  MESSAGE: (id: string) => `/me/messages/${id}`,
  ATTACHMENTS: (id: string) => `/me/messages/${id}/attachments`,
} as const;

// =============================================================================
// AI Configuration
// =============================================================================

/**
 * Claude AI model configuration
 */
export const AI_CONFIG = {
  MODEL: 'claude-haiku-4-5-20251001',
  MAX_TOKENS: 2048,
  ANTHROPIC_VERSION: '2023-06-01',
} as const;

// =============================================================================
// Google Sheets Configuration
// =============================================================================

/**
 * Google Sheets configuration for job roles
 */
export const GOOGLE_SHEETS_CONFIG = {
  SPREADSHEET_ID: '1jT-Xosd4W3ev7WTGiRHxupW_a7xBQ_Y0mn2ncoX65al',
  JOB_ROLES_RANGE: 'Sheet1!A2:C',
} as const;

// =============================================================================
// Email Monitoring Configuration
// =============================================================================

/**
 * Email monitoring service settings
 */
export const EMAIL_MONITORING_CONFIG = {
  POLLING_INTERVAL_MS: 30000, // 30 seconds
  MAX_EMAILS_PER_POLL: 10,
  EMAIL_FILTER_KEYWORDS: ['Application', 'application'],
} as const;

/**
 * LocalStorage keys for email monitoring state
 */
export const EMAIL_STORAGE_KEYS = {
  MONITORING_ENABLED: 'email_monitoring_enabled',
  LAST_CHECK: 'email_last_check',
  PROCESSED_COUNT: 'email_processed_count',
} as const;

// =============================================================================
// Microsoft OAuth Configuration
// =============================================================================

/**
 * Microsoft OAuth endpoints and settings
 */
export const MICROSOFT_AUTH_CONFIG = {
  AUTHORIZE_URL: 'https://login.microsoftonline.com',
  SCOPES: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Mail.Read',
    'Mail.ReadWrite',
  ],
  REDIRECT_PATH: '/auth/callback',
} as const;

/**
 * LocalStorage keys for Microsoft OAuth state
 */
export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'ms_access_token',
  REFRESH_TOKEN: 'ms_refresh_token',
  TOKEN_EXPIRY: 'ms_token_expiry',
  USER_EMAIL: 'ms_user_email',
  USER_NAME: 'ms_user_name',
} as const;

// =============================================================================
// UI Configuration
// =============================================================================

/**
 * Dashboard metrics configuration
 */
export const DASHBOARD_CONFIG = {
  PIPELINE_STAGES: [
    { stage: 'New/Screened', statuses: ['new_application', 'ai_screened', 'human_reviewed'] },
    { stage: 'Shortlisted', statuses: ['shortlisted'] },
    { stage: 'Submitted', statuses: ['submitted_to_client'] },
    { stage: 'Interview', statuses: ['interview_scheduled', 'interview_completed'] },
    { stage: 'Offer', statuses: ['offer_extended', 'offer_accepted'] },
    { stage: 'Placed', statuses: ['placement_started', 'placement_completed'] },
  ],
} as const;

/**
 * CGP Brand colors (matches tailwind.config.js)
 */
export const BRAND_COLORS = {
  CGP_RED: '#C41E3A',
  CGP_RED_DARK: '#9A1830',
  CGP_RED_LIGHT: '#E8345A',
} as const;

// =============================================================================
// Validation
// =============================================================================

/**
 * AI score validation
 */
export const AI_SCORE_CONFIG = {
  MIN: 1,
  MAX: 10,
  TOP_CANDIDATE_THRESHOLD: 8,
  REVIEW_THRESHOLD: 5,
} as const;

// =============================================================================
// Date Formatting
// =============================================================================

/**
 * Common date format patterns
 */
export const DATE_FORMATS = {
  DISPLAY: 'dd MMM yyyy',
  DISPLAY_WITH_TIME: 'dd MMM yyyy HH:mm',
  ISO_DATE: 'yyyy-MM-dd',
  TIME_24H: 'HH:mm',
} as const;
