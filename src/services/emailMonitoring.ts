// Email Monitoring Service
// Polls Outlook inbox for new application emails and triggers AI screening

import { getValidAccessToken, isConnected } from './microsoftAuth';
import { performFullScreening, type ScreeningResult } from './aiScreening';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const POLLING_INTERVAL = 30000; // 30 seconds
const MONITORING_ENABLED_KEY = 'email_monitoring_enabled';
const LAST_CHECK_KEY = 'email_last_check';
const PROCESSED_COUNT_KEY = 'email_processed_count';

export interface EmailMessage {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  receivedDateTime: string;
  hasAttachments: boolean;
  isRead: boolean;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  contentBytes: string;
  size: number;
}

export interface ProcessedEmail {
  emailId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  receivedAt: string;
  attachmentName: string;
  screeningResult: ScreeningResult;
  processedAt: string;
}

export interface MonitoringStatus {
  isEnabled: boolean;
  isConnected: boolean;
  lastCheck: string | null;
  processedCount: number;
  isPolling: boolean;
}

// Event callbacks
type EmailProcessedCallback = (result: ProcessedEmail) => void;
type StatusChangeCallback = (status: MonitoringStatus) => void;
type ErrorCallback = (error: Error) => void;

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let isPolling = false;
let onEmailProcessed: EmailProcessedCallback | null = null;
let onStatusChange: StatusChangeCallback | null = null;
let onError: ErrorCallback | null = null;

// Check if monitoring is enabled
export function isMonitoringEnabled(): boolean {
  return localStorage.getItem(MONITORING_ENABLED_KEY) === 'true';
}

// Enable/disable monitoring
export function setMonitoringEnabled(enabled: boolean): void {
  localStorage.setItem(MONITORING_ENABLED_KEY, enabled.toString());

  if (enabled) {
    startPolling();
  } else {
    stopPolling();
  }

  notifyStatusChange();
}

// Get last check timestamp
export function getLastCheck(): string | null {
  return localStorage.getItem(LAST_CHECK_KEY);
}

// Get processed email count
export function getProcessedCount(): number {
  const count = localStorage.getItem(PROCESSED_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

// Increment processed count
function incrementProcessedCount(): void {
  const current = getProcessedCount();
  localStorage.setItem(PROCESSED_COUNT_KEY, (current + 1).toString());
}

// Reset processed count
export function resetProcessedCount(): void {
  localStorage.setItem(PROCESSED_COUNT_KEY, '0');
}

// Get current monitoring status
export function getMonitoringStatus(): MonitoringStatus {
  return {
    isEnabled: isMonitoringEnabled(),
    isConnected: isConnected(),
    lastCheck: getLastCheck(),
    processedCount: getProcessedCount(),
    isPolling,
  };
}

// Register callbacks
export function registerCallbacks(callbacks: {
  onEmailProcessed?: EmailProcessedCallback;
  onStatusChange?: StatusChangeCallback;
  onError?: ErrorCallback;
}): void {
  if (callbacks.onEmailProcessed) onEmailProcessed = callbacks.onEmailProcessed;
  if (callbacks.onStatusChange) onStatusChange = callbacks.onStatusChange;
  if (callbacks.onError) onError = callbacks.onError;
}

// Notify status change
function notifyStatusChange(): void {
  if (onStatusChange) {
    onStatusChange(getMonitoringStatus());
  }
}

// Fetch unread emails with "Application" in subject
async function fetchApplicationEmails(accessToken: string): Promise<EmailMessage[]> {
  const filter = encodeURIComponent(
    "isRead eq false and (contains(subject, 'Application') or contains(subject, 'application'))"
  );

  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages?$filter=${filter}&$select=id,subject,from,receivedDateTime,hasAttachments,isRead&$orderby=receivedDateTime desc&$top=10`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch emails: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

// Fetch attachments for an email
async function fetchEmailAttachments(
  accessToken: string,
  messageId: string
): Promise<EmailAttachment[]> {
  const response = await fetch(
    `${GRAPH_API_BASE}/me/messages/${messageId}/attachments`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch attachments: ${response.statusText}`);
  }

  const data = await response.json();
  return data.value || [];
}

// Mark email as read
async function markEmailAsRead(accessToken: string, messageId: string): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ isRead: true }),
  });

  if (!response.ok) {
    console.warn(`Failed to mark email as read: ${response.statusText}`);
  }
}

// Smart attachment selection: prefer resume over cover letter
function selectBestAttachment(attachments: EmailAttachment[]): EmailAttachment {
  if (attachments.length === 1) {
    return attachments[0];
  }

  // Keywords that indicate a resume
  const resumeKeywords = ['resume', 'cv', 'curriculum', 'vitae'];
  // Keywords that indicate a cover letter (to avoid)
  const coverLetterKeywords = ['cover', 'letter', 'motivation', 'introduction'];

  // Score each attachment
  const scored = attachments.map((att) => {
    const nameLower = att.name.toLowerCase();
    let score = 0;

    // Check for resume keywords (positive score)
    for (const keyword of resumeKeywords) {
      if (nameLower.includes(keyword)) {
        score += 10;
        break;
      }
    }

    // Check for cover letter keywords (negative score)
    for (const keyword of coverLetterKeywords) {
      if (nameLower.includes(keyword)) {
        score -= 10;
        break;
      }
    }

    // Larger files are more likely to be resumes (add small bonus based on size)
    // Resumes typically have more content than cover letters
    score += Math.min(att.size / 100000, 2); // Max 2 points for size

    return { attachment: att, score };
  });

  // Sort by score (highest first) and return the best one
  scored.sort((a, b) => b.score - a.score);

  console.log(
    'Attachment selection:',
    scored.map((s) => ({ name: s.attachment.name, score: s.score }))
  );

  return scored[0].attachment;
}

// Process a single email
async function processEmail(
  accessToken: string,
  email: EmailMessage
): Promise<ProcessedEmail | null> {
  if (!email.hasAttachments) {
    // No attachments, mark as read and skip
    await markEmailAsRead(accessToken, email.id);
    return null;
  }

  // Fetch attachments
  const attachments = await fetchEmailAttachments(accessToken, email.id);

  // Find PDF attachments
  const pdfAttachments = attachments.filter(
    (att) =>
      att.contentType === 'application/pdf' ||
      att.name.toLowerCase().endsWith('.pdf')
  );

  if (pdfAttachments.length === 0) {
    // No PDF attachments, mark as read and skip
    await markEmailAsRead(accessToken, email.id);
    return null;
  }

  // Smart attachment selection: prefer resume over cover letter
  const pdfAttachment = selectBestAttachment(pdfAttachments);

  try {
    // The contentBytes is already base64 encoded from Graph API
    const screeningResult = await performFullScreening({
      pdfBase64: pdfAttachment.contentBytes,
      emailSubject: email.subject,
      source: 'Email', // Source is email
    });

    // Mark email as read after successful processing
    await markEmailAsRead(accessToken, email.id);

    const processedEmail: ProcessedEmail = {
      emailId: email.id,
      subject: email.subject,
      fromEmail: email.from.emailAddress.address,
      fromName: email.from.emailAddress.name,
      receivedAt: email.receivedDateTime,
      attachmentName: pdfAttachment.name,
      screeningResult,
      processedAt: new Date().toISOString(),
    };

    return processedEmail;
  } catch (error) {
    console.error(`Failed to process email ${email.id}:`, error);
    // Don't mark as read on error so it can be retried
    throw error;
  }
}

// Poll for new emails
async function pollForEmails(): Promise<void> {
  if (isPolling) {
    return; // Already polling
  }

  if (!isConnected()) {
    console.log('Not connected to Microsoft, skipping poll');
    return;
  }

  isPolling = true;
  notifyStatusChange();

  try {
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      console.log('No valid access token, skipping poll');
      isPolling = false;
      notifyStatusChange();
      return;
    }

    // Fetch unread application emails
    const emails = await fetchApplicationEmails(accessToken);

    console.log(`Found ${emails.length} unread application emails`);

    // Process each email
    for (const email of emails) {
      try {
        const result = await processEmail(accessToken, email);

        if (result) {
          incrementProcessedCount();

          if (onEmailProcessed) {
            onEmailProcessed(result);
          }
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    }

    // Update last check time
    localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
  } catch (error) {
    console.error('Error polling for emails:', error);
    if (onError && error instanceof Error) {
      onError(error);
    }
  } finally {
    isPolling = false;
    notifyStatusChange();
  }
}

// Start polling
export function startPolling(): void {
  if (!isMonitoringEnabled()) {
    console.log('Monitoring is disabled, not starting polling');
    return;
  }

  if (!isConnected()) {
    console.log('Not connected to Microsoft, not starting polling');
    return;
  }

  if (pollingInterval) {
    console.log('Polling already running');
    return;
  }

  console.log('Starting email monitoring polling');

  // Poll immediately
  pollForEmails();

  // Then poll every 30 seconds
  pollingInterval = setInterval(pollForEmails, POLLING_INTERVAL);

  notifyStatusChange();
}

// Stop polling
export function stopPolling(): void {
  if (pollingInterval) {
    console.log('Stopping email monitoring polling');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }

  isPolling = false;
  notifyStatusChange();
}

// Manual trigger for immediate poll
export async function triggerManualPoll(): Promise<void> {
  await pollForEmails();
}

// Initialize monitoring on app start
export function initializeMonitoring(): void {
  if (isMonitoringEnabled() && isConnected()) {
    startPolling();
  }
}

// Cleanup on app unmount
export function cleanupMonitoring(): void {
  stopPolling();
  onEmailProcessed = null;
  onStatusChange = null;
  onError = null;
}
