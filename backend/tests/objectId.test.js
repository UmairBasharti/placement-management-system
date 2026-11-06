const test = require('node:test');
const assert = require('node:assert/strict');
const { isObjectIdString } = require('../utils/objectId');

test('isObjectIdString accepts a 24-character hex string', () => {
    assert.equal(isObjectIdString('507f1f77bcf86cd799439011'), true);
    assert.equal(isObjectIdString('507F1F77BCF86CD799439011'), true);
});

test('isObjectIdString rejects query operators, arrays and other types', () => {
    assert.equal(isObjectIdString({ $ne: null }), false);
    assert.equal(isObjectIdString({ $gt: '' }), false);
    assert.equal(isObjectIdString(['507f1f77bcf86cd799439011']), false);
    assert.equal(isObjectIdString(123456789012), false);
    assert.equal(isObjectIdString(null), false);
    assert.equal(isObjectIdString(undefined), false);
});

test('isObjectIdString rejects strings of the wrong length or alphabet', () => {
    assert.equal(isObjectIdString(''), false);
    assert.equal(isObjectIdString('507f1f77bcf86cd79943901'), false);
    assert.equal(isObjectIdString('507f1f77bcf86cd7994390111'), false);
    assert.equal(isObjectIdString('507f1f77bcf86cd79943901z'), false);
    assert.equal(isObjectIdString('{"$ne":null}'), false);
});
