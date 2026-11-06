const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSkills, parseSkillList } = require('../utils/skills');

test('finds skills written with aliases and different casing', () => {
    assert.deepEqual(extractSkills('I know nodejs, JS and MS Excel'), ['Node.js', 'JavaScript', 'Excel']);
});

test('"Node.js" is not also reported as JavaScript, and "JavaScript" is not reported as Java', () => {
    assert.deepEqual(extractSkills('Built an API with Node.js'), ['Node.js']);
    assert.deepEqual(extractSkills('Wrote JavaScript daily'), ['JavaScript']);
});

test('handles symbols in names: C++, C#, .NET vs ASP.NET', () => {
    assert.deepEqual(extractSkills('C++ and C# developer'), ['C++', 'C#']);
    assert.deepEqual(extractSkills('Worked with ASP.NET'), ['ASP.NET']);
    assert.deepEqual(extractSkills('Used .NET for services'), ['.NET']);
});

test('ordinary English words are not mistaken for skills', () => {
    assert.deepEqual(extractSkills('I will express my interest and rest assured, we are hiring operations staff'), []);
});

test('ambiguous skills (C, R, Express) only count as separate items of the Skills section', () => {
    assert.deepEqual(extractSkills('Experience with C and R and Express'), []);
    const section = 'Python, C, R, Express';
    assert.deepEqual(extractSkills('', { skillsSection: section }).sort(), ['C', 'Express.js', 'R'].sort());
});

test('multi-word and hyphenated skills match flexibly', () => {
    assert.deepEqual(extractSkills('scikit learn and Scikit-learn'), ['Scikit-learn']);
    assert.deepEqual(extractSkills('Rest APIs, power bi'), ['REST APIs', 'Power BI']);
});

test('business skills are recognised (MBA)', () => {
    const found = extractSkills('Financial modelling, Tally ERP, GST filing, SEO and Digital Marketing');
    for (const skill of ['Financial Analysis', 'Tally', 'GST', 'SEO', 'Digital Marketing']) assert.ok(found.includes(skill), skill);
});

test('parseSkillList canonicalises known skills and keeps unknown short items', () => {
    assert.deepEqual(parseSkillList('nodejs, JS, Zapier, ms excel'), ['Node.js', 'JavaScript', 'Excel', 'Zapier']);
});

test('parseSkillList treats a standalone C and R as skills', () => {
    assert.deepEqual(parseSkillList('Java, C, R').sort(), ['C', 'Java', 'R']);
});

test('parseSkillList drops empty, tiny and very long items and removes duplicates', () => {
    const list = parseSkillList('js, JavaScript, , x, ' + 'long '.repeat(20));
    assert.deepEqual(list, ['JavaScript']);
});

test('parseSkillList copes with empty input', () => {
    assert.deepEqual(parseSkillList(''), []);
    assert.deepEqual(parseSkillList(undefined), []);
});
