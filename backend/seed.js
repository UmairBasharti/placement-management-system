// Fills the database with demo data:  npm run seed   (add --force to skip the confirmation question)
// It creates no admin: run  npm run create-admin  afterwards to make one with your own e-mail and password.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const readline = require('readline');
const User = require('./models/user.model');
const Student = require('./models/student.model');
const Company = require('./models/company.model');
const Application = require('./models/application.model');
const Event = require('./models/event.model');
const Activity = require('./models/activity.model');

dotenv.config();

// Same workaround as server.js: see DNS_SERVERS in .env.example
if (process.env.DNS_SERVERS) {
    require('dns').setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

require('./config/validateEnv')(['MONGODB_URI']);

const force = process.argv.includes('--force');

// Local date-time string like the admin form produces, `days` from today
function eventDate(days, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`;
}

function ask(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function confirmClearing() {
    const existing = await User.countDocuments();
    if (existing === 0 || force) return;
    if (!process.stdin.isTTY) {
        console.error(`The database already has ${existing} users. Run with --force to clear it and re-seed.`);
        process.exit(1);
    }
    const answer = await ask(`The database already has ${existing} users. Clear ALL data and re-seed? (y/N): `);
    if (answer.trim().toLowerCase() !== 'y') {
        console.log('Seed cancelled.');
        process.exit(0);
    }
}

async function clearAll() {
    const db = mongoose.connection.db;
    await Promise.all([
        User.deleteMany({}), Student.deleteMany({}), Company.deleteMany({}),
        Application.deleteMany({}), Event.deleteMany({}), Activity.deleteMany({}),
        db.collection('resumes.files').deleteMany({}), db.collection('resumes.chunks').deleteMany({})
    ]);
}

async function createStudent({ name, email, branch, skills, education, projects }) {
    const user = await User.create({ name, email, password: 'student123', role: 'student', branch });
    await Student.create({ user: user._id, skills, education, projects });
    console.log(`Created student: ${email} / student123 (${branch})`);
}

async function seed() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await confirmClearing();
    await clearAll();
    console.log('Cleared existing data');

    await createStudent({
        name: 'Rahul Sharma', email: 'rahul@pms.com', branch: 'MCA',
        skills: 'JavaScript, Node.js, MongoDB',
        education: 'B.Sc Computer Science — 2022',
        projects: 'Portfolio website, Todo app'
    });
    await createStudent({
        name: 'Priya Patel', email: 'priya@pms.com', branch: 'MBA',
        skills: 'Financial Analysis, MS Excel, Communication',
        education: 'B.Com — 2022',
        projects: 'Market research report, Financial model'
    });

    await Company.insertMany([
        {
            name: 'Tech Solutions Inc.', location: 'Mumbai', jobType: 'Full Time', branches: ['MCA', 'MBA'],
            description: 'Technology company specialising in software development and IT services.',
            requirements: 'JavaScript, Node.js, SQL, problem solving',
            requiredSkills: ['JavaScript', 'Node.js', 'SQL', 'Problem Solving'],
            package: '8-12 LPA', postedDate: new Date(Date.now() - 12 * 86400000)
        },
        {
            name: 'Global Finance Corp', location: 'Delhi', jobType: 'Internship', branches: ['MBA'],
            description: 'Financial services company offering internships in research, risk and client management.',
            requirements: 'Financial analysis, MS Excel, communication skills',
            requiredSkills: ['Financial Analysis', 'Excel', 'Communication'],
            package: '30-40k per month', postedDate: new Date(Date.now() - 8 * 86400000)
        },
        {
            name: 'Innovate Software', location: 'Bangalore', jobType: 'Full Time', branches: ['MCA'],
            description: 'Product company building web tools for small businesses.',
            requirements: 'React, Node.js, MongoDB, REST APIs, Git',
            requiredSkills: ['React', 'Node.js', 'MongoDB', 'REST APIs', 'Git'],
            package: '6-10 LPA', postedDate: new Date(Date.now() - 4 * 86400000)
        }
    ]);
    console.log('Created 3 companies');

    await Event.insertMany([
        { title: 'Campus Drive: Tech Solutions Inc.', date: eventDate(3, 10, 0), description: 'Aptitude test followed by technical interviews.' },
        { title: 'Resume Workshop', date: eventDate(6, 14, 30), description: 'How to write a one-page resume. Bring a printed copy.' }
    ]);
    console.log('Created 2 events');

    console.log('\nSeed complete. Next: create your admin account with  npm run create-admin  and start the app with  npm run dev');
}

seed()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Seed error:', error.message);
        process.exit(1);
    });
