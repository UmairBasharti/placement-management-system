const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user.model');
const Student = require('./models/student.model');
const Company = require('./models/company.model');

dotenv.config();

// Same workaround as server.js: see DNS_SERVERS in .env.example
if (process.env.DNS_SERVERS) {
    require('dns').setServers(process.env.DNS_SERVERS.split(',').map(s => s.trim()));
}

const seed = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/placement_management_system');
        console.log('Connected to MongoDB');

        // Fix #16: Check for existing data before clearing
        const existingUsers = await User.countDocuments();
        if (existingUsers > 0) {
            console.log(`⚠️  Database already has ${existingUsers} users.`);
            const readline = require('readline');
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const answer = await new Promise(resolve => {
                rl.question('Do you want to clear all data and re-seed? (y/N): ', resolve);
            });
            rl.close();
            if (answer.toLowerCase() !== 'y') {
                console.log('Seed cancelled.');
                process.exit(0);
            }
        }

        // Clear existing data
        await Promise.all([
            User.deleteMany({}),
            Student.deleteMany({}),
            Company.deleteMany({})
        ]);
        console.log('Cleared existing data');

        // Admin user — no Student profile needed
        // Fix #14: Read password from env so it's not visible in source
        const adminPassword = process.env.ADMIN_SEED_PASSWORD || 'admin123';
        await User.create({
            name: 'Admin',
            email: 'admin@pms.com',
            password: adminPassword,
            role: 'admin'
        });
        console.log(`Created admin  →  admin@pms.com / ${adminPassword === 'admin123' ? 'admin123 (default — set ADMIN_SEED_PASSWORD env var to change)' : '****(from env)'}`);

        // Student 1 — MCA
        const user1 = await User.create({
            name: 'Rahul Sharma',
            email: 'rahul@pms.com',
            password: 'student123',
            role: 'student',
            branch: 'MCA'
        });
        await Student.create({
            user: user1._id,
            skills: 'JavaScript, Node.js, MongoDB',
            education: 'B.Sc Computer Science — 2022',
            projects: 'Portfolio website, Todo app',
            status: 'Unplaced'
        });
        console.log('Created student →  rahul@pms.com / student123');

        // Student 2 — MBA
        const user2 = await User.create({
            name: 'Priya Patel',
            email: 'priya@pms.com',
            password: 'student123',
            role: 'student',
            branch: 'MBA'
        });
        await Student.create({
            user: user2._id,
            skills: 'Financial Analysis, MS Excel, Communication',
            education: 'B.Com — 2022',
            projects: 'Market research report, Financial model',
            status: 'Unplaced'
        });
        console.log('Created student →  priya@pms.com / student123');

        // Seed companies
        await Company.insertMany([
            {
                name: 'Tech Solutions Inc.',
                description: 'Leading technology company specialising in software development and IT services.',
                location: 'Mumbai',
                jobType: 'Full Time',
                branches: ['MCA', 'MBA'],
                requirements: 'Strong programming skills, problem-solving ability',
                package: '8-12 LPA',
                postedDate: new Date('2024-03-01')
            },
            {
                name: 'Global Finance Corp',
                description: 'International financial services company offering roles in finance and management.',
                location: 'Delhi',
                jobType: 'Internship',
                branches: ['MBA'],
                requirements: 'Financial analysis, communication skills',
                package: '30-40k per month',
                postedDate: new Date('2024-03-05')
            },
            {
                name: 'Innovate Software',
                description: 'Software development company focused on innovative solutions.',
                location: 'Bangalore',
                jobType: 'Full Time',
                branches: ['MCA'],
                requirements: 'Web development, database management',
                package: '6-10 LPA',
                postedDate: new Date('2024-03-10')
            }
        ]);
        console.log('Seeded 3 companies');

        console.log('\n✅ Seed complete. Run: cd backend && npm run dev');
        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error.message);
        process.exit(1);
    }
};

seed();
