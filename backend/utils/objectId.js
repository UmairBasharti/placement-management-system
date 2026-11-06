// An id sent in a request body must be a plain 24-character hex string. Anything else (an object such as
// {"$ne": null}, an array, a number) could be read by MongoDB as a query operator instead of an id.
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const isObjectIdString = (value) => typeof value === 'string' && OBJECT_ID.test(value);

module.exports = { isObjectIdString };
