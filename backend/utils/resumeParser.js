// Reads a resume PDF and suggests profile content (skills, education, projects).
// Rule-based and fully local: no external service, nothing leaves the server.
const { extractSkills } = require('./skills');

const MAX_PAGES = 10;
const MAX_TEXT = 60000;
const PARSE_TIMEOUT_MS = 8000;

class ResumeReadError extends Error {}

// Plain text of the PDF (first pages only). Throws ResumeReadError if it cannot be read.
async function extractPdfText(buffer) {
    const work = (async () => {
        const { getDocumentProxy, extractText } = await import('unpdf');
        const pdf = await getDocumentProxy(new Uint8Array(buffer));
        if (pdf.numPages > MAX_PAGES) throw new ResumeReadError(`The resume has more than ${MAX_PAGES} pages`);
        const { text } = await extractText(pdf, { mergePages: true });
        return String(text || '').slice(0, MAX_TEXT);
    })();

    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new ResumeReadError('Reading the PDF took too long')), PARSE_TIMEOUT_MS);
    });
    try {
        return await Promise.race([work, timeout]);
    } catch (err) {
        throw err instanceof ResumeReadError ? err : new ResumeReadError('The PDF could not be read');
    } finally {
        clearTimeout(timer);
    }
}

// ── Section detection ────────────────────────────────────────────────────────
const HEADINGS = {
    skills: /^(technical |key |core |professional |it )?(skills?|skill set|competenc(y|ies)|technologies|tools( and technologies)?|areas of expertise)$/,
    education: /^(education|educational (qualifications?|background|details)|academic (qualifications?|background|details|profile)|qualifications?)$/,
    projects: /^(academic |personal |key |major |mini |technical )?projects?( work| experience| details)?$/,
    other: /^((work|professional|industrial|relevant) experience|experience|employment( history)?|internships?|certifications?|courses|achievements?|awards?( and honou?rs)?|honou?rs|interests|hobbies|extra ?curricular( activities)?|activities|languages|references|declaration|summary|objective|career objective|profile|professional summary|personal (details|information|profile)|contact( details| information)?|volunteer(ing)?( experience)?|publications|positions of responsibility|strengths)$/
};

function headingOf(line) {
    if (line.length > 45) return null;
    const label = line.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!label || label.split(' ').length > 5) return null;
    return Object.keys(HEADINGS).find((name) => HEADINGS[name].test(label)) || null;
}

function splitSections(lines) {
    const sections = { skills: [], education: [], projects: [] };
    let current = null;
    for (const line of lines) {
        const heading = headingOf(line);
        if (heading) {
            current = heading in sections ? heading : null;
            continue;
        }
        if (current) sections[current].push(line);
    }
    return sections;
}

// Remove bullets, blank lines and runaway length
function cleanBlock(lines, maxChars) {
    const text = lines
        .map((l) => l.replace(/^[\s•▪◦●·*\-–—]+/, '').trim())
        .filter(Boolean)
        .join('\n');
    return text.length > maxChars ? text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : text;
}

// Suggestions from the plain text of a resume
function parseResume(text) {
    const lines = String(text || '').replace(/\r/g, '\n').split('\n').map((l) => l.replace(/ /g, ' ').trim()).filter(Boolean);
    const sections = splitSections(lines);

    return {
        skills: extractSkills(lines.join('\n'), { skillsSection: sections.skills.join('\n') }),
        education: cleanBlock(sections.education, 800),
        projects: cleanBlock(sections.projects, 1500)
    };
}

module.exports = { extractPdfText, parseResume, ResumeReadError };
