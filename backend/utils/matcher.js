// Matches students to jobs by comparing skills. Pure functions (no database access) so they are easy to test.
const { extractSkills, parseSkillList, skillKey } = require('./skills');

// Skills a student has: the profile "skills" field, plus known skills mentioned in their projects
function studentSkills(student) {
    const labels = new Map(parseSkillList(student.skills).map((label) => [skillKey(label), label]));
    for (const name of extractSkills(student.projects)) labels.set(skillKey(name), name);
    return labels;
}

// Skills a job asks for: the explicit list the admin entered, or else the known skills in its requirements text
function requiredSkills(company) {
    const explicit = (company.requiredSkills || []).join(', ');
    const list = explicit ? parseSkillList(explicit) : extractSkills(company.requirements);
    return new Map(list.map((label) => [skillKey(label), label]));
}

// How well `have` covers `need`: percentage of required skills the student has, plus the lists
function scoreMatch(have, need) {
    const matched = [];
    const missing = [];
    for (const [key, label] of need) (have.has(key) ? matched : missing).push(label);
    return {
        matchScore: need.size ? Math.round((matched.length / need.size) * 100) : null,
        matchedSkills: matched,
        missingSkills: missing
    };
}

// Companies ranked for one student. Companies that list no recognisable skills cannot be scored and are left out;
// so are companies that share no skill with the student.
function recommendCompanies(student, companies, { limit = 6 } = {}) {
    const have = studentSkills(student);
    if (!have.size) return [];

    return companies
        .map((company) => ({ company, ...scoreMatch(have, requiredSkills(company)) }))
        .filter((r) => r.matchScore !== null && r.matchedSkills.length > 0)
        .sort((a, b) =>
            b.matchScore - a.matchScore ||
            b.matchedSkills.length - a.matchedSkills.length ||
            new Date(b.company.postedDate) - new Date(a.company.postedDate))
        .slice(0, limit);
}

// Students ranked for one company (for the placement cell)
function matchStudents(company, students, { limit = 10 } = {}) {
    const need = requiredSkills(company);
    if (!need.size) return [];

    return students
        .map((student) => ({ student, ...scoreMatch(studentSkills(student), need) }))
        .filter((r) => r.matchedSkills.length > 0)
        .sort((a, b) => b.matchScore - a.matchScore || b.matchedSkills.length - a.matchedSkills.length)
        .slice(0, limit);
}

module.exports = { studentSkills, requiredSkills, scoreMatch, recommendCompanies, matchStudents };
