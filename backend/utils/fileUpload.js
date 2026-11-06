const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');

const MAX_SIZE = 5 * 1024 * 1024;

// Resumes are kept in MongoDB (GridFS), not on disk, so they survive restarts and redeploys.
// The upload is held in memory (5 MB cap) so it can be checked before anything is stored.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') return cb(null, true);
        const err = new Error('Only PDF files are allowed');
        err.code = 'INVALID_FILE_TYPE';
        cb(err, false);
    }
});

// Runs multer and turns upload problems into clean 400 responses
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

// The MIME type comes from the client and can be faked, so check the real header ("%PDF-")
function isPdfBuffer(buffer) {
    return Buffer.isBuffer(buffer) && buffer.subarray(0, 1024).includes('%PDF-');
}

// No path parts or control characters, bounded length
function cleanFileName(name) {
    const base = path.basename(String(name || '')).replace(/[\x00-\x1f\x7f<>:"/\\|?*]+/g, '_').trim().slice(0, 100);
    return base || 'resume.pdf';
}

let bucket;
function getBucket() {
    if (!bucket) bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'resumes' });
    return bucket;
}

function saveResume(buffer, filename) {
    return new Promise((resolve, reject) => {
        const stream = getBucket().openUploadStream(filename, { contentType: 'application/pdf' });
        stream.on('error', reject);
        stream.on('finish', () => resolve(stream.id));
        stream.end(buffer);
    });
}

async function deleteResume(fileId) {
    if (!fileId) return;
    try {
        await getBucket().delete(fileId);
    } catch (err) {
        if (!/FileNotFound/i.test(err.message)) console.error('Could not delete resume file:', err.message);
    }
}

async function resumeExists(fileId) {
    if (!fileId) return false;
    return (await getBucket().find({ _id: fileId }).limit(1).toArray()).length === 1;
}

async function readResume(fileId) {
    const chunks = [];
    for await (const chunk of getBucket().openDownloadStream(fileId)) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// Stream a stored resume to an already-authorised caller
async function sendResumeFile(res, resume) {
    if (!resume || !resume.fileId || !(await resumeExists(resume.fileId))) {
        return res.status(404).json({ success: false, message: 'No resume uploaded' });
    }
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(cleanFileName(resume.name))}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store'
    });
    getBucket().openDownloadStream(resume.fileId)
        .on('error', () => res.destroy())
        .pipe(res);
}

module.exports = {
    resumeUpload, isPdfBuffer, cleanFileName, saveResume, deleteResume, readResume, sendResumeFile, MAX_SIZE
};
