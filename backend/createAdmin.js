// Creates an admin account, or resets an admin's password:  npm run create-admin
// There is no built-in admin. The e-mail and password are typed here (the password shows only as ****), so
// nothing is stored in the code, the README or the seed data. It never touches other data.
// For scripted set-ups, ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME) can be set instead of typing them.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const User = require('./models/user.model');
const { PASSWORD_MIN, PASSWORD_MAX } = require('./config/constants');

dotenv.config();

// Same workaround as server.js: see DNS_SERVERS in .env.example
if (process.env.DNS_SERVERS) {
    require('dns').setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

require('./config/validateEnv')(['MONGODB_URI']);

const scripted = Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

// Like ask(), but the typed characters show as "*" instead of the password itself
function askHidden(question) {
    if (!process.stdin.isTTY) return ask(question);   // piped input cannot be hidden
    return new Promise((resolve) => {
        const input = process.stdin;
        let typed = '';
        process.stdout.write(question);
        readline.emitKeypressEvents(input);
        input.setRawMode(true);
        input.resume();

        const finish = () => {
            input.off('keypress', onKeypress);
            input.setRawMode(false);
            input.pause();
            process.stdout.write('\n');
            resolve(typed);
        };
        const onKeypress = (text, key = {}) => {
            if (key.name === 'return' || key.name === 'enter') return finish();
            if (key.ctrl && key.name === 'c') {
                process.stdout.write('\n');
                process.exit(130);
            }
            if (key.name === 'backspace') {
                if (typed) {
                    typed = typed.slice(0, -1);
                    process.stdout.write('\b \b');
                }
                return;
            }
            if (text && !key.ctrl && !key.meta && text >= ' ') {   // letters, digits, symbols; not arrows or other control keys
                typed += text;
                process.stdout.write('*');
            }
        };
        input.on('keypress', onKeypress);
    });
}

const yes = async (question) => (await ask(question)).trim().toLowerCase() === 'y';

async function askNewPassword() {
    for (let attempt = 0; attempt < 3; attempt++) {
        const password = await askHidden(`Password (${PASSWORD_MIN}-${PASSWORD_MAX} characters): `);
        if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
            console.log(`The password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters.`);
        } else if (password !== await askHidden('Repeat the password: ')) {
            console.log('The two passwords do not match.');
        } else {
            return password;
        }
    }
    throw new Error('Too many attempts.');
}

// Other admin accounts (for example one made earlier with a known password) can be removed on the spot
async function offerToRemoveOtherAdmins(keepEmail) {
    const others = await User.find({ role: 'admin', email: { $ne: keepEmail } });
    for (const other of others) {
        if (await yes(`Another admin account exists: ${other.email}. Delete it? (y/N): `)) {
            await User.deleteOne({ _id: other._id });
            console.log(`Deleted ${other.email}.`);
        }
    }
}

async function main() {
    if (!scripted && !process.stdin.isTTY) {
        throw new Error('Run this in a terminal, or set ADMIN_EMAIL and ADMIN_PASSWORD.');
    }
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });

    const defaultName = 'Placement Cell';
    const name = scripted
        ? (process.env.ADMIN_NAME || defaultName)
        : (await ask(`Admin name [${defaultName}]: `)).trim() || defaultName;
    const email = (scripted
        ? process.env.ADMIN_EMAIL
        : await ask('Admin email (an inbox you can open: password reset links are sent there): ')
    ).trim().toLowerCase();

    const existing = await User.findOne({ email });
    if (existing && existing.role !== 'admin') {
        throw new Error('That email belongs to a student account. Use a different email.');
    }
    if (existing && !scripted && !await yes('An admin with this email already exists. Reset its password? (y/N): ')) {
        console.log('Cancelled.');
        return;
    }

    const password = scripted ? process.env.ADMIN_PASSWORD : await askNewPassword();

    if (existing) {
        existing.password = password;               // hashed by the model before saving
        existing.passwordChangedAt = new Date();    // ends every login started before now
        await existing.save();
        console.log(`Password reset for ${email}.`);
    } else {
        await User.create({ name, email, password, role: 'admin', emailVerified: true });
        console.log(`Created admin ${email}. Log in with "Admin login" on the home page.`);
    }

    if (!scripted) await offerToRemoveOtherAdmins(email);
}

main()
    .catch((error) => {
        const message = error.errors ? Object.values(error.errors).map(e => e.message).join(' ') : error.message;
        console.error(`Could not set up the admin: ${message}`);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect())
    .then(() => process.exit());
