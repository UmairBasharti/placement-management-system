const test = require('node:test');
const assert = require('node:assert/strict');
const makePdf = require('./helpers/makePdf');
const { extractPdfText, parseResume, ResumeReadError } = require('../utils/resumeParser');

const MCA_RESUME = [
    'RAHUL SHARMA',
    'rahul@example.com | +91 98765 43210 | Nashik',
    'SUMMARY',
    'Final-year MCA student interested in web development.',
    'EDUCATION',
    'MCA, Dr. B.V. Hiray College, Malegaon (2024 - 2026) - CGPA 8.4',
    'B.Sc Computer Science, Pune University (2021 - 2024) - 78%',
    'SKILLS',
    'Languages: JavaScript, Python, Java, C, C++',
    'Web: HTML5, CSS3, React.js, Node.js, Express.js, REST APIs',
    'Databases: MongoDB, MySQL',
    'Tools: Git, GitHub, Docker, VS Code',
    'PROJECTS',
    '- Placement Portal: full stack app using Node.js, Express and MongoDB with JWT authentication',
    '- Weather App: React app that consumes a public API',
    'EXPERIENCE',
    'Intern, ABC Pvt Ltd - built dashboards'
];

const MBA_RESUME = [
    'PRIYA PATEL',
    'SKILLS',
    'Financial Analysis, MS Excel, Tally ERP, GST, Communication Skills, Power BI',
    'EDUCATION',
    'MBA (Finance), Dr. B.V. Hiray College (2024-2026)',
    'B.Com, 2022',
    'ACADEMIC PROJECTS',
    'Market research report on retail banking'
];

test('parses an MCA resume: skills, education and projects', () => {
    const r = parseResume(MCA_RESUME.join('\n'));
    for (const skill of ['JavaScript', 'Python', 'Java', 'C', 'C++', 'HTML', 'CSS', 'React', 'Node.js', 'Express.js',
        'REST APIs', 'MongoDB', 'MySQL', 'Git', 'GitHub', 'Docker', 'JWT']) {
        assert.ok(r.skills.includes(skill), `missing skill ${skill}`);
    }
    for (const wrong of ['Go', 'R', 'Rust']) assert.ok(!r.skills.includes(wrong), `unexpected skill ${wrong}`);
    assert.match(r.education, /^MCA, Dr\. B\.V\. Hiray College/);
    assert.match(r.education, /B\.Sc Computer Science/);
    assert.doesNotMatch(r.education, /Languages:/);                 // stops at the next heading
    assert.match(r.projects, /^Placement Portal/);                  // bullet stripped
    assert.match(r.projects, /Weather App/);
    assert.doesNotMatch(r.projects, /Intern, ABC/);                 // stops at EXPERIENCE
});

test('parses an MBA resume with business skills', () => {
    const r = parseResume(MBA_RESUME.join('\n'));
    for (const skill of ['Financial Analysis', 'Excel', 'Tally', 'GST', 'Communication', 'Power BI', 'Banking', 'Market Research']) {
        assert.ok(r.skills.includes(skill), `missing skill ${skill}`);
    }
    assert.match(r.education, /MBA \(Finance\)/);
    assert.match(r.projects, /retail banking/);
});

test('a resume without headings still yields skills, with empty education/projects', () => {
    const r = parseResume('Experienced with Docker and Kubernetes.\nAlso strong in SQL.');
    assert.deepEqual(r.skills, ['Docker', 'Kubernetes', 'SQL']);
    assert.equal(r.education, '');
    assert.equal(r.projects, '');
});

test('empty or missing text gives an empty suggestion', () => {
    assert.deepEqual(parseResume(''), { skills: [], education: '', projects: '' });
    assert.deepEqual(parseResume(undefined), { skills: [], education: '', projects: '' });
});

test('very long sections are trimmed', () => {
    const r = parseResume(['EDUCATION', ...Array.from({ length: 200 }, (_, i) => `Line number ${i} of a very long education section`)].join('\n'));
    assert.ok(r.education.length <= 801);
    assert.ok(r.education.endsWith('…'));
});

test('end to end: a real PDF is read and parsed', async () => {
    const text = await extractPdfText(makePdf(MCA_RESUME));
    assert.match(text, /RAHUL SHARMA/);
    const r = parseResume(text);
    assert.ok(r.skills.includes('Node.js') && r.skills.includes('MongoDB') && r.skills.includes('C'));
    assert.match(r.education, /Hiray College/);
    assert.match(r.projects, /Placement Portal/);
});

test('a PDF without any text (e.g. a scan) gives empty text instead of failing', async () => {
    assert.equal((await extractPdfText(makePdf([]))).trim(), '');
});

test('something that is not a PDF raises ResumeReadError', async () => {
    await assert.rejects(() => extractPdfText(Buffer.from('this is not a pdf at all')), ResumeReadError);
});
