'use strict';

function notFound(msg)      { const e = new Error(msg); e.status = 404; return e; }
function badRequest(msg)    { const e = new Error(msg); e.status = 400; return e; }
function conflict(msg)      { const e = new Error(msg); e.status = 409; return e; }
function unprocessable(msg) { const e = new Error(msg); e.status = 422; return e; }

module.exports = { notFound, badRequest, conflict, unprocessable };
