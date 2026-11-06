const test = require('node:test');
const assert = require('node:assert/strict');
const { afterApply, afterDecision } = require('../utils/placementStatus');

const decide = (current, oldStatus, newStatus, applications) =>
    afterDecision({ current, oldStatus, newStatus, applications: applications.map(status => ({ status })) });

test('applying moves an Unplaced student to Under Review', () => {
    assert.equal(afterApply('Unplaced'), 'Under Review');
});

test('applying never downgrades Under Review / Interview Scheduled / Placed', () => {
    for (const s of ['Under Review', 'Interview Scheduled', 'Placed']) assert.equal(afterApply(s), s);
});

test('accepting an application places the student', () => {
    assert.equal(decide('Under Review', 'Pending', 'Accepted', ['Accepted']), 'Placed');
});

test('rejecting the only pending application sends an Under Review student back to Unplaced', () => {
    assert.equal(decide('Under Review', 'Pending', 'Rejected', ['Rejected']), 'Unplaced');
});

test('rejecting one application keeps Under Review while another is still pending', () => {
    assert.equal(decide('Under Review', 'Pending', 'Rejected', ['Rejected', 'Pending']), 'Under Review');
});

test('rejecting an unrelated application does not unplace a student accepted elsewhere', () => {
    assert.equal(decide('Placed', 'Pending', 'Rejected', ['Accepted', 'Rejected']), 'Placed');
});

test('a manually set Placed status is not reset by an unrelated rejection', () => {
    assert.equal(decide('Placed', 'Pending', 'Rejected', ['Rejected']), 'Placed');
});

test('Interview Scheduled (set by an admin) is kept on rejection', () => {
    assert.equal(decide('Interview Scheduled', 'Pending', 'Rejected', ['Rejected']), 'Interview Scheduled');
});

test('withdrawing an accepted offer falls back to Under Review if something is pending', () => {
    assert.equal(decide('Placed', 'Accepted', 'Pending', ['Pending']), 'Under Review');
});

test('withdrawing an accepted offer with nothing else open leaves the student Unplaced', () => {
    assert.equal(decide('Placed', 'Accepted', 'Rejected', ['Rejected']), 'Unplaced');
});
