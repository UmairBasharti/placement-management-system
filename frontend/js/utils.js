// Shared helpers loaded before each page script.

// Escape text before putting it inside an HTML template string (prevents stored XSS).
// Use esc() around every value that can contain user- or admin-entered text:
//   el.innerHTML = `<h5>${esc(company.name)}</h5>`;
(function (global) {
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    global.esc = function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);
    };

    // Resumes are private: a plain <a href> can't send the login token, so fetch the PDF with the
    // Authorization header and show it from a temporary blob URL in a new tab.
    // Throws an Error with a user-friendly message on failure.
    global.openProtectedPdf = async function openProtectedPdf(endpoint) {
        const tab = window.open('', '_blank');   // open synchronously so popup blockers allow it
        try {
            const res = await fetch('/api' + endpoint, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) {
                let message = 'Could not open the resume';
                try { message = (await res.json()).message || message; } catch { /* not JSON */ }
                throw new Error(message);
            }
            const url = URL.createObjectURL(await res.blob());
            if (tab) tab.location.href = url; else window.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            if (tab) tab.close();
            throw err;
        }
    };
})(window);
