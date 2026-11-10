// One-time tokens for the e-mailed links (verify e-mail, reset password).
// The link carries the random token; the database stores only its SHA-256 hash, so a leaked
// database cannot be used to build a working link. The token is 256 bits of randomness, so
// the fast hash is enough (no salt or bcrypt needed, and the hash can be looked up directly).
const crypto = require('crypto');

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

// Returns the token to put in the link and the hash to store
function createToken() {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, hash: hashToken(token) };
}

module.exports = { TOKEN_PATTERN, hashToken, createToken };
