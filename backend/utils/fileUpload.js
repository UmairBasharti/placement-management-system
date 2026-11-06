const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const MAX_SIZE = 5 * 1024 * 1024;   // 5 MB cap

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    // Random name + fixed .pdf extension — never trust the client's filename or extension
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.pdf`)
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true);
    const err = new Error('Only PDF files are allowed');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE, files: 1 } });

// Express middleware: run multer and turn upload problems into clean 400 responses
function resumeUpload(req, res, next) {
    upload.single('resume')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (maximum 5 MB)' : 'Invalid upload';
            return res.status(400).json({ success: false, message });
        }
        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    });
}

// Only ever resolve inside uploadDir (basename strips any path the database might contain)
function resolveUploadPath(stored) {
    return path.join(uploadDir, path.basename(String(stored)));
}

// The client-supplied MIME type can be faked, so check the file's real header: "%PDF-"
async function isPdfFile(filePath) {
    let handle;
    try {
        handle = await fs.promises.open(filePath, 'r');
        const buf = Buffer.alloc(1024);
        const { bytesRead } = await handle.read(buf, 0, 1024, 0);
        return buf.subarray(0, bytesRead).includes('%PDF-');
    } catch {
        return false;
    } finally {
        if (handle) await handle.close();
    }
}

async function removeFile(filePath) {
    try {
        await fs.promises.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('Could not delete file:', err.message);
    }
}

// Safe display name: no path parts or control characters, bounded length
function cleanFileName(name) {
    const base = path.basename(String(name || '')).replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_').trim().slice(0, 100);
    return base || 'resume.pdf';
}

// Stream a stored resume to an already-authorised caller
function sendResumeFile(res, resume) {
    if (!resume || !resume.path) {
        return res.status(404).json({ success: false, message: 'No resume uploaded' });
    }
    res.sendFile(resolveUploadPath(resume.path), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(cleanFileName(resume.name))}`,
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'private, no-store'
        }
    }, (err) => {
        if (err && !res.headersSent) {
            res.status(404).json({ success: false, message: 'Resume file not found' });
        }
    });
}

module.exports = { resumeUpload, resolveUploadPath, isPdfFile, removeFile, cleanFileName, sendResumeFile, MAX_SIZE };
