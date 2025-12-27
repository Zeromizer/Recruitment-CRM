import { useState } from 'react';
import { X, Phone, CheckCircle, XCircle, Clock, PhoneOff, AlertCircle, UserX, Pause, Voicemail, Calendar, ArrowRight } from 'lucide-react';
import type { CallOutcome, Candidate, Activity } from '../types';
import { CALL_OUTCOME_LABELS, CALL_OUTCOME_COLORS } from '../types';

interface CallOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  activity: Activity | null;
  onSubmit: (outcome: CallOutcome, notes: string, followUpDate: string | null, shouldUpdateStatus: boolean, newStatus: string | null) => void;
}

const OUTCOME_OPTIONS: { value: CallOutcome; icon: React.ElementType; description: string }[] = [
  { value: 'Shortlisted', icon: CheckCircle, description: 'Good fit - prepare resume for client' },
  { value: 'Rejected', icon: XCircle, description: 'Not suitable for the role' },
  { value: 'Follow-up Required', icon: Clock, description: 'Need more information or call back' },
  { value: 'No Answer', icon: PhoneOff, description: 'Candidate did not pick up' },
  { value: 'Voicemail Left', icon: Voicemail, description: 'Left a voicemail message' },
  { value: 'Not Interested', icon: UserX, description: 'Candidate declined the opportunity' },
  { value: 'On Hold', icon: Pause, description: 'Interested but not available now' },
  { value: 'Wrong Number', icon: AlertCircle, description: 'Contact details are incorrect' },
];

export default function CallOutcomeModal({ isOpen, onClose, candidate, activity: _activity, onSubmit }: CallOutcomeModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [showFollowUpDate, setShowFollowUpDate] = useState(false);

  if (!isOpen) return null;

  const handleOutcomeSelect = (outcome: CallOutcome) => {
    setSelectedOutcome(outcome);
    // Show follow-up date for certain outcomes
    setShowFollowUpDate(['Follow-up Required', 'No Answer', 'Voicemail Left', 'On Hold'].includes(outcome));
  };

  const handleSubmit = () => {
    if (!selectedOutcome) return;

    // Determine if status should be updated and to what
    let shouldUpdateStatus = false;
    let newStatus: string | null = null;

    if (selectedOutcome === 'Shortlisted') {
      shouldUpdateStatus = true;
      newStatus = 'shortlisted';
    } else if (selectedOutcome === 'Rejected') {
      shouldUpdateStatus = true;
      newStatus = 'rejected_human';
    } else if (selectedOutcome === 'Not Interested') {
      shouldUpdateStatus = true;
      newStatus = 'withdrawn';
    } else if (selectedOutcome === 'On Hold') {
      shouldUpdateStatus = true;
      newStatus = 'on_hold';
    }

    onSubmit(
      selectedOutcome,
      notes,
      showFollowUpDate && followUpDate ? followUpDate : null,
      shouldUpdateStatus,
      newStatus
    );

    // Reset and close
    setSelectedOutcome(null);
    setNotes('');
    setFollowUpDate('');
    setShowFollowUpDate(false);
    onClose();
  };

  const getNextStepMessage = () => {
    if (!selectedOutcome) return null;

    switch (selectedOutcome) {
      case 'Shortlisted':
        return {
          title: 'Next: Prepare resume for client',
          description: 'Candidate will be moved to "Shortlisted" status. You can then submit their resume to the client.',
          icon: ArrowRight,
          color: 'text-green-600',
        };
      case 'Rejected':
        return {
          title: 'Candidate will be rejected',
          description: 'Candidate will be moved to "Rejected (Human)" status and removed from active pipeline.',
          icon: XCircle,
          color: 'text-red-600',
        };
      case 'Follow-up Required':
        return {
          title: 'Schedule follow-up',
          description: 'Set a date to call back the candidate. They will appear in your follow-ups.',
          icon: Calendar,
          color: 'text-yellow-600',
        };
      case 'Not Interested':
        return {
          title: 'Candidate withdrawn',
          description: 'Candidate will be marked as withdrawn from the process.',
          icon: UserX,
          color: 'text-purple-600',
        };
      case 'On Hold':
        return {
          title: 'Candidate on hold',
          description: 'Candidate will be placed on hold. Set a follow-up date to reconnect.',
          icon: Pause,
          color: 'text-blue-600',
        };
      default:
        return {
          title: 'No status change',
          description: 'Outcome will be logged but status remains unchanged.',
          icon: Clock,
          color: 'text-gray-600',
        };
    }
  };

  const nextStep = getNextStepMessage();

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cgp-red/10 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-cgp-red" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Log Call Outcome</h2>
              <p className="text-sm text-slate-500">Call with {candidate.full_name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Outcome Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              What was the outcome of the call?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {OUTCOME_OPTIONS.map(({ value, icon: Icon, description }) => {
                const colors = CALL_OUTCOME_COLORS[value];
                const isSelected = selectedOutcome === value;
                return (
                  <button
                    key={value}
                    onClick={() => handleOutcomeSelect(value)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text} border-2`
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? colors.text : 'text-slate-400'}`} />
                      <div>
                        <p className={`font-medium ${isSelected ? colors.text : 'text-slate-700'}`}>
                          {CALL_OUTCOME_LABELS[value].split(' - ')[0]}
                        </p>
                        <p className={`text-xs mt-0.5 ${isSelected ? colors.text : 'text-slate-500'}`}>
                          {description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Next Step Preview */}
          {nextStep && selectedOutcome && (
            <div className={`p-4 rounded-lg border ${
              selectedOutcome === 'Shortlisted' ? 'bg-green-50 border-green-200' :
              selectedOutcome === 'Rejected' ? 'bg-red-50 border-red-200' :
              'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-start gap-3">
                <nextStep.icon className={`w-5 h-5 mt-0.5 ${nextStep.color}`} />
                <div>
                  <p className={`font-medium ${nextStep.color}`}>{nextStep.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{nextStep.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Follow-up Date (conditional) */}
          {showFollowUpDate && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Follow-up Date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="input w-full"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-slate-500 mt-1">
                When should you follow up with this candidate?
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Call Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full resize-none"
              rows={3}
              placeholder="Add any relevant notes from the call..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedOutcome}
            className={`btn-primary ${!selectedOutcome ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedOutcome === 'Shortlisted' ? 'Shortlist Candidate' :
             selectedOutcome === 'Rejected' ? 'Reject Candidate' :
             'Log Outcome'}
          </button>
        </div>
      </div>
    </div>
  );
}
