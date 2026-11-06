// Rules that keep a student's placement status consistent with their applications.
// Statuses: Unplaced → Under Review → Interview Scheduled → Placed
// ('Interview Scheduled' is only ever set manually by an admin and is never overridden here.)

// A new application can only move an Unplaced student forward — it never downgrades
// Interview Scheduled / Placed students.
function afterApply(current) {
    return current === 'Unplaced' ? 'Under Review' : current;
}

// After an admin changes one application's status.
//   current      — the student's current placement status
//   oldStatus    — the application's status before the change
//   newStatus    — the application's status after the change
//   applications — ALL of the student's applications, with the change already applied
function afterDecision({ current, oldStatus, newStatus, applications }) {
    const hasAccepted = applications.some(a => a.status === 'Accepted');
    const hasPending = applications.some(a => a.status === 'Pending');

    if (newStatus === 'Accepted') return 'Placed';

    // An accepted offer was withdrawn and nothing else is accepted: fall back
    if (oldStatus === 'Accepted' && current === 'Placed' && !hasAccepted) {
        return hasPending ? 'Under Review' : 'Unplaced';
    }

    // Nothing left under review → back to Unplaced (Placed / Interview Scheduled are kept)
    if (current === 'Under Review' && !hasPending) return 'Unplaced';

    return current;
}

module.exports = { afterApply, afterDecision };
