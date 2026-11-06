// Fail fast with a clear message instead of crashing later (or silently running with a weak default).
const MIN_SECRET_LENGTH = 32;

function validateEnv(required) {
    const missing = required.filter(key => !process.env[key] || !process.env[key].trim());
    if (missing.length) {
        console.error(`❌ Missing required environment variable(s): ${missing.join(', ')}`);
        console.error('   Copy backend/.env.example to backend/.env and fill in the values.');
        process.exit(1);
    }

    if (required.includes('JWT_SECRET')) {
        const secret = process.env.JWT_SECRET;
        const weak = secret.length < MIN_SECRET_LENGTH || /^(change_?me|replace-with|secret|password)/i.test(secret);
        if (weak && process.env.NODE_ENV === 'production') {
            console.error(`❌ JWT_SECRET is too weak for production (needs ${MIN_SECRET_LENGTH}+ random characters).`);
            console.error('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
            process.exit(1);
        }
        if (weak) {
            console.warn(`⚠️  JWT_SECRET looks weak (use ${MIN_SECRET_LENGTH}+ random characters before deploying).`);
        }
    }
}

module.exports = validateEnv;
