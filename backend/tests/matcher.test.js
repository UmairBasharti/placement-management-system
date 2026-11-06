const test = require('node:test');
const assert = require('node:assert/strict');
const { studentSkills, requiredSkills, scoreMatch, recommendCompanies, matchStudents } = require('../utils/matcher');

const company = (name, requirements, extra = {}) => ({ name, requirements, postedDate: '2026-01-01', ...extra });

test('student skills come from the skills field and from technologies named in projects', () => {
    const have = studentSkills({ skills: 'JS, nodejs', projects: 'Portfolio built with React and MongoDB' });
    assert.deepEqual([...have.values()].sort(), ['JavaScript', 'MongoDB', 'Node.js', 'React'].sort());
});

test('a job lists its skills explicitly, or they are read from the requirements text', () => {
    assert.deepEqual([...requiredSkills(company('A', 'Strong SQL and Python')).values()], ['SQL', 'Python']);
    assert.deepEqual([...requiredSkills(company('B', 'ignored text', { requiredSkills: ['react', 'Docker'] })).values()], ['React', 'Docker']);
});

test('scoreMatch reports percentage, matched and missing skills', () => {
    const have = studentSkills({ skills: 'JavaScript, Node.js' });
    const need = requiredSkills(company('X', 'JavaScript, Node.js, Docker, MongoDB'));
    assert.deepEqual(scoreMatch(have, need), { matchScore: 50, matchedSkills: ['JavaScript', 'Node.js'], missingSkills: ['Docker', 'MongoDB'] });
});

test('scoreMatch returns null when the job lists no recognisable skills', () => {
    assert.equal(scoreMatch(studentSkills({ skills: 'Python' }), requiredSkills(company('Y', 'a positive attitude and willingness to learn'))).matchScore, null);
});

test('recommendCompanies ranks by match, skips unscorable and non-matching jobs, respects the limit', () => {
    const student = { skills: 'JavaScript, Node.js, MongoDB', projects: '' };
    const jobs = [
        company('Web Dev', 'JavaScript, Node.js, MongoDB'),            // 100 %
        company('Backend', 'Node.js, Docker, Kubernetes, AWS'),         // 25 %
        company('Finance', 'Financial analysis, Tally'),               // no overlap -> excluded
        company('Vague', 'good attitude'),                              // cannot be scored -> excluded
        company('Full Stack', 'JavaScript, MongoDB, React')            // 67 %
    ];
    const ranked = recommendCompanies(student, jobs);
    assert.deepEqual(ranked.map((r) => [r.company.name, r.matchScore]), [['Web Dev', 100], ['Full Stack', 67], ['Backend', 25]]);
    assert.deepEqual(recommendCompanies(student, jobs, { limit: 1 }).map((r) => r.company.name), ['Web Dev']);
});

test('ties are broken by more matched skills, then by newest posting', () => {
    const student = { skills: 'Python, SQL', projects: '' };
    const ranked = recommendCompanies(student, [
        company('Older', 'Python, SQL', { postedDate: '2026-01-01' }),
        company('Newer', 'Python, SQL', { postedDate: '2026-03-01' })
    ]);
    assert.deepEqual(ranked.map((r) => r.company.name), ['Newer', 'Older']);
});

test('a student with no skills gets no recommendations', () => {
    assert.deepEqual(recommendCompanies({ skills: '', projects: '' }, [company('A', 'Python')]), []);
});

test('matchStudents ranks the students who fit a job best', () => {
    const job = company('Data Co', 'Python, SQL, Power BI');
    const ranked = matchStudents(job, [
        { id: 1, skills: 'Python', projects: '' },
        { id: 2, skills: 'Python, SQL, Power BI', projects: '' },
        { id: 3, skills: 'Tally', projects: '' }
    ]);
    assert.deepEqual(ranked.map((r) => [r.student.id, r.matchScore]), [[2, 100], [1, 33]]);
});
