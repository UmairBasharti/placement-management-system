// Shared helpers loaded before each page script.

// Escape text before putting it inside an HTML template string (prevents stored XSS).
// Use esc() around every value that can contain user- or admin-entered text:
//   el.innerHTML = `<h5>${esc(company.name)}</h5>`;
(function (global) {
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    global.esc = function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
    };
})(window);
