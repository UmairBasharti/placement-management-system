const test = require('node:test');
const assert = require('node:assert/strict');
const { isPdfBuffer, cleanFileName } = require('../utils/fileUpload');

test('isPdfBuffer accepts a real PDF header', () => {
    assert.equal(isPdfBuffer(Buffer.from('%PDF-1.4\n1 0 obj\n%%EOF')), true);
});

test('isPdfBuffer accepts a header preceded by a little junk (allowed by the PDF spec)', () => {
    assert.equal(isPdfBuffer(Buffer.concat([Buffer.alloc(500), Buffer.from('%PDF-1.7')])), true);
});

test('isPdfBuffer rejects HTML disguised as a PDF', () => {
    assert.equal(isPdfBuffer(Buffer.from('<html><script>alert(1)</script></html>')), false);
});

test('isPdfBuffer rejects empty input and non-buffers', () => {
    assert.equal(isPdfBuffer(Buffer.alloc(0)), false);
    assert.equal(isPdfBuffer(undefined), false);
    assert.equal(isPdfBuffer('%PDF-1.4'), false);
});

test('isPdfBuffer ignores a PDF marker that appears only after the first KB', () => {
    assert.equal(isPdfBuffer(Buffer.concat([Buffer.alloc(2000), Buffer.from('%PDF-1.4')])), false);
});

test('cleanFileName strips path parts and control characters and limits the length', () => {
    assert.equal(cleanFileName('C:\\Users\\me\\My Resume.pdf'), 'My Resume.pdf');
    assert.equal(cleanFileName('../../evil.pdf'), 'evil.pdf');
    assert.equal(cleanFileName('bad<name>:"|?*.pdf'), 'bad_name_.pdf');
    assert.equal(cleanFileName(''), 'resume.pdf');
    assert.equal(cleanFileName(undefined), 'resume.pdf');
    assert.ok(cleanFileName('a'.repeat(300) + '.pdf').length <= 100);
});
