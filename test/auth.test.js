"use strict";

const assert = require('node:assert/strict');
const test = require('node:test');
const auth = require('../auth');

test('recognizes explicit authentication expiry signals', () => {
    assert.equal(auth.isAuthExpiredResponse({ status: 401 }, ''), true);
    assert.equal(auth.isAuthExpiredResponse({ status: 403 }, 'Login Required'), true);
    assert.equal(auth.isAuthExpiredResponse({
        status: 200,
        redirected: true,
        url: 'https://next.cult.fit/login'
    }, ''), true);
});

test('does not classify unrelated failures or other redirects as expired sessions', () => {
    assert.equal(auth.isAuthExpiredResponse({ status: 403 }, 'Forbidden'), false);
    assert.equal(auth.isAuthExpiredResponse({
        status: 200,
        redirected: true,
        url: 'https://www.cult.fit/classes'
    }, ''), false);
    assert.equal(auth.isAuthExpiredResponse({
        status: 200,
        redirected: true,
        url: 'not a url'
    }, ''), false);
});
