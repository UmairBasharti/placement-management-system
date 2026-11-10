const test = require('node:test');
const assert = require('node:assert/strict');
const { createToken, hashToken, TOKEN_PATTERN } = require('../utils/tokens');

test('createToken returns a 64-character hex token and the hash of it', () => {
    const { token, hash } = createToken();
    assert.match(token, TOKEN_PATTERN);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hashToken(token), hash);
});

test('the stored hash is not the token itself', () => {
    const { token, hash } = createToken();
    assert.notEqual(hash, token);
});

test('tokens are not repeated', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createToken().token));
    assert.equal(tokens.size, 200);
});

test('hashToken is stable, so the link token can be looked up by its hash', () => {
    assert.equal(hashToken('abc'), hashToken('abc'));
    assert.notEqual(hashToken('abc'), hashToken('abd'));
    // SHA-256 of "abc" (published test vector)
    assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('TOKEN_PATTERN rejects anything that is not a 64-character lowercase hex string', () => {
    for (const bad of ['', 'abc', 'g'.repeat(64), 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), '{"$ne":null}']) {
        assert.doesNotMatch(bad, TOKEN_PATTERN);
    }
});
