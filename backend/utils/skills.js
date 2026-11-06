// Finds known skills in free text and normalises skill lists ("nodejs, JS" → "Node.js", "JavaScript").
const DICTIONARY = require('../data/skills');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

// A term may be written with spaces, hyphens or underscores interchangeably ("scikit learn", "scikit-learn")
const termPattern = (term) => escapeRegExp(term.toLowerCase()).replace(/[ \-_]+/g, '[\\s\\-_]+');

// Not preceded by a letter/digit/+/# and not the "js" part of "node.js"; not followed by a letter/digit/+/#
const BEFORE = '(?<![a-z0-9+#])(?<![a-z0-9]\\.)';
const AFTER = '(?![a-z0-9+#])';

const entries = DICTIONARY.map(([name, aliases = [], options = {}]) => {
    const terms = [...new Set([name, ...aliases].map((t) => t.toLowerCase()))];
    const byLength = [...terms].sort((a, b) => b.length - a.length);
    return {
        name,
        terms,
        strict: Boolean(options.strict),
        regex: new RegExp(`${BEFORE}(?:${byLength.map(termPattern).join('|')})${AFTER}`, 'i')
    };
});

const SKILL_LIST_SEPARATORS = /[,;\n|•·●▪]+/;

// Skills found in `text`, in order of first appearance (canonical names, no duplicates).
// Ambiguous skills such as "C" or "R" only count when they are a separate item in `skillsSection`.
function extractSkills(text, { skillsSection = '' } = {}) {
    const haystack = String(text || '');
    const items = String(skillsSection || '').split(SKILL_LIST_SEPARATORS).map((t) => t.trim().toLowerCase());
    const found = [];

    for (const entry of entries) {
        if (entry.strict) {
            const at = items.findIndex((item) => entry.terms.includes(item));
            if (at !== -1) found.push({ name: entry.name, index: haystack.length + at });
        } else {
            const match = entry.regex.exec(haystack);
            if (match) found.push({ name: entry.name, index: match.index });
        }
    }
    return found.sort((a, b) => a.index - b.index).map((f) => f.name);
}

// Turns a comma/newline separated skills field into a clean list.
// Known skills become their canonical name; other short items are kept as typed.
function parseSkillList(text) {
    const source = String(text || '');
    const labels = new Map();                       // lower-case key → label, in order
    for (const name of extractSkills(source, { skillsSection: source })) labels.set(name.toLowerCase(), name);

    for (const raw of source.split(SKILL_LIST_SEPARATORS)) {
        const item = raw.replace(/^[\s\-–—*]+/, '').trim();
        if (item.length < 2 || item.length > 40 || item.split(/\s+/).length > 4) continue;
        if (extractSkills(item, { skillsSection: item }).length) continue;   // already represented above
        const key = item.toLowerCase();
        if (!labels.has(key)) labels.set(key, item);
    }
    return [...labels.values()];
}

const skillKey = (label) => String(label).toLowerCase();

module.exports = { extractSkills, parseSkillList, skillKey, dictionarySize: entries.length };
