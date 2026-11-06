const test = require('node:test');
const assert = require('node:assert/strict');
const errorHandler = require('../middleware/error.middleware');

// Minimal Express-like response double
function run(err) {
    const res = {
        headersSent: false, statusCode: null, body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
    };
    const originalError = console.error;
    console.error = () => {};               // the handler logs unknown errors; keep test output quiet
    try { errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {}); } finally { console.error = originalError; }
    return res;
}

test('Mongoose ValidationError -> 400 with our own schema messages', () => {
    const err = { name: 'ValidationError', errors: { name: { message: 'Name is required' }, email: { message: 'Email is required' } } };
    const res = run(err);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Name is required');
    assert.deepEqual(res.body.errors, ['Name is required', 'Email is required']);
});

test('CastError on _id -> 400 "Invalid id" (no Mongoose text)', () => {
    const res = run({ name: 'CastError', path: '_id', message: 'Cast to ObjectId failed for value "x" (type string) at path "_id"' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid id');
    assert.doesNotMatch(JSON.stringify(res.body), /Cast to ObjectId/);
});

test('duplicate key (E11000) -> 409 with a friendly message, no index details', () => {
    const res = run({ code: 11000, keyPattern: { email: 1 }, message: 'E11000 duplicate key error collection: pms.users index: email_1' });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'Email already registered');
    assert.doesNotMatch(JSON.stringify(res.body), /E11000|pms\.users/);
});

test('malformed JSON body -> 400', () => {
    const res = run({ type: 'entity.parse.failed', message: 'Unexpected token' });
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid JSON in request body');
});

test('unknown errors -> generic 500 that leaks nothing', () => {
    const res = run(new Error('connect ECONNREFUSED 10.0.0.5:27017 — secret internal detail'));
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { success: false, message: 'Internal server error' });
});
