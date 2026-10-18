"use strict";

function isAuthExpiredMessage(text) {
    if (!text) {
        return false;
    }
    return /login required/i.test(String(text)) || /auth expired/i.test(String(text));
}

function isAuthExpiredResponse(response, bodyText) {
    if (response?.status === 401 || isAuthExpiredMessage(bodyText)) {
        return true;
    }
    if (!response?.redirected || !response.url) {
        return false;
    }
    try {
        const finalUrl = new URL(response.url);
        return finalUrl.protocol === 'https:' && finalUrl.hostname === 'next.cult.fit';
    } catch {
        return false;
    }
}

module.exports = {
    isAuthExpiredMessage,
    isAuthExpiredResponse
};
