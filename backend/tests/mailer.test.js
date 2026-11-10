const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const mailer = require('../utils/mailer');

const ENV_KEYS = ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'APP_URL', 'PORT', 'NODE_ENV'];

// Runs `fn` with a clean mail-related environment and restores it afterwards
async function withEnv(values, fn) {
    const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    ENV_KEYS.forEach((key) => delete process.env[key]);
    Object.assign(process.env, values);
    try { return await fn(); } finally {
        ENV_KEYS.forEach((key) => delete process.env[key]);
        Object.entries(saved).forEach(([key, value]) => { if (value !== undefined) process.env[key] = value; });
    }
}

// Collects what is printed to the console while `fn` runs
async function captureLog(fn) {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try { await fn(); } finally { console.log = original; }
    return lines.join('\n');
}

test('links point at APP_URL (trailing slash ignored) and carry the token', () => withEnv({ APP_URL: 'https://pms.example.com/' }, () => {
    assert.equal(mailer.verificationLink('abc'), 'https://pms.example.com/verify-email.html?token=abc');
    assert.equal(mailer.resetLink('abc'), 'https://pms.example.com/reset-password.html?token=abc');
}));

test('without APP_URL the links point at this server on its port', () => withEnv({ PORT: '5055' }, () => {
    assert.equal(mailer.appUrl(), 'http://localhost:5055');
}));

test('without SMTP settings the e-mail is printed instead of sent (development)', () => withEnv({ APP_URL: 'http://localhost:5000' }, async () => {
    const output = await captureLog(() => mailer.sendVerificationEmail({ name: 'Asha', email: 'asha@example.com' }, 'tok123'));
    assert.match(output, /To: asha@example\.com/);
    assert.match(output, /http:\/\/localhost:5000\/verify-email\.html\?token=tok123/);
}));

test('without SMTP settings production refuses to print links into the logs', () => withEnv({ NODE_ENV: 'production' }, async () => {
    await assert.rejects(
        mailer.sendPasswordResetEmail({ name: 'Asha', email: 'asha@example.com' }, 'tok123'),
        /SMTP_USER and SMTP_PASS are not set/
    );
}));

// The transporter is created once and kept, so everything about the SMTP path is checked in this one test
test('with SMTP settings the e-mail goes through Gmail by default, with the name escaped', () => withEnv({
    SMTP_USER: 'sender@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop'
}, async () => {
    let options;
    let sent;
    const original = nodemailer.createTransport;
    nodemailer.createTransport = (opts) => {
        options = opts;
        return { sendMail: async (message) => { sent = message; } };
    };
    try {
        await mailer.sendVerificationEmail({ name: '<img src=x onerror=alert(1)>', email: 'a@b.co' }, 'tok');
    } finally { nodemailer.createTransport = original; }

    assert.equal(options.host, 'smtp.gmail.com');
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.auth.user, 'sender@gmail.com');
    assert.equal(options.auth.pass, 'abcdefghijklmnop');   // the spaces Google shows in app passwords are dropped

    assert.equal(sent.to, 'a@b.co');
    assert.equal(sent.from, '"Placement Management System" <sender@gmail.com>');
    assert.match(sent.text, /verify-email\.html\?token=tok/);
    assert.doesNotMatch(sent.html, /<img src=x/);
    assert.match(sent.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
}));
