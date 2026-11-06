const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isPdfFile, resolveUploadPath, cleanFileName } = require('../utils/fileUpload');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pms-test-'));
const write = (name, content) => { const p = path.join(tmp, name); fs.writeFileSync(p, content); return p; };
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('isPdfFile accepts a real PDF header', async () => {
    assert.equal(await isPdfFile(write('ok.pdf', '%PDF-1.4\n1 0 obj\n%%EOF')), true);
});

test('isPdfFile accepts a header that is preceded by a little junk (allowed by the PDF spec)', async () => {
    assert.equal(await isPdfFile(write('junk.pdf', Buffer.concat([Buffer.alloc(500), Buffer.from('%PDF-1.7')]))), true);
});

test('isPdfFile rejects HTML disguised as a PDF', async () => {
    assert.equal(await isPdfFile(write('evil.pdf', '<html><script>alert(1)</script></html>')), false);
});

test('isPdfFile rejects empty and missing files', async () => {
    assert.equal(await isPdfFile(write('empty.pdf', '')), false);
    assert.equal(await isPdfFile(path.join(tmp, 'does-not-exist.pdf')), false);
});

test('resolveUploadPath cannot escape the uploads directory', () => {
    const uploads = path.dirname(resolveUploadPath('x.pdf'));
    for (const hostile of ['../../etc/passwd', '..\\..\\secret.txt', '/etc/passwd', 'a/../../b.pdf']) {
        assert.equal(path.dirname(resolveUploadPath(hostile)), uploads, hostile);
    }
});

test('cleanFileName strips path parts, control characters and limits the length', () => {
    assert.equal(cleanFileName('C:\\Users\\me\\My Resume.pdf'), 'My Resume.pdf');
    assert.equal(cleanFileName('../../evil.pdf'), 'evil.pdf');
    assert.equal(cleanFileName('bad<name>:"|?*.pdf'), 'bad_name_.pdf');
    assert.equal(cleanFileName(''), 'resume.pdf');
    assert.equal(cleanFileName(undefined), 'resume.pdf');
    assert.ok(cleanFileName('a'.repeat(300) + '.pdf').length <= 100);
});
