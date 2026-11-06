// Loads the browser helper file in a sandbox and checks the XSS escaping function.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sandbox = {};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../frontend/js/utils.js'), 'utf8'), sandbox);
const esc = sandbox.esc;

test('esc neutralises HTML and quote characters', () => {
    assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(esc(`Alumni's <b>Meet</b> & "Greet"`), 'Alumni&#39;s &lt;b&gt;Meet&lt;/b&gt; &amp; &quot;Greet&quot;');
});

test('esc handles null, undefined and non-strings', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
    assert.equal(esc(42), '42');
});

test('esc leaves ordinary text unchanged', () => {
    assert.equal(esc('Tech Solutions Inc. — Mumbai'), 'Tech Solutions Inc. — Mumbai');
});

test('the escaped output contains no raw angle brackets (cannot open a tag)', () => {
    assert.doesNotMatch(esc('</script><svg/onload=alert(1)>'), /[<>]/);
});
