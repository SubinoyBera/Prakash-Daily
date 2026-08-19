/**
 * Email checking tuned for an OTP flow.
 *
 * Two jobs: reject text that cannot receive mail, and catch plausible-looking
 * typos in common domains. The second matters more than usual here — a typo'd
 * address passes every structural check, so the user sits waiting for a code
 * that was delivered to someone else's inbox, or nowhere.
 *
 * Messages are written to say what to fix, not that something is "invalid".
 */

export type checkEmail =
    | { state: 'empty' }
    | { state: 'invalid'; message: string }
    | { state: 'valid'; normalized: string; suggestion?: string };

/** Providers common enough that a near-miss is almost certainly a typo. */
const COMMON_DOMAINS = [
    'gmail.com',
    'googlemail.com',
    'yahoo.com',
    'yahoo.in',
    'yahoo.co.in',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'icloud.com',
    'me.com',
    'proton.me',
    'protonmail.com',
    'rediffmail.com',
    'zoho.com',
    'zohomail.in',
    'aol.com',
];

/** Standard Levenshtein, iterative single-row. */
function distance(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);

    for (let i = 1; i <= a.length; i++) {
        const row = [i];
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = row;
    }
    return prev[b.length];
}

function suggestDomain(domain: string): string | undefined {
    if (COMMON_DOMAINS.includes(domain)) return undefined;
    // Short domains produce too many false hits (mail.com -> gmail.com).
    if (domain.length < 6) return undefined;

    let best: string | undefined;
    let bestDistance = 3;

    for (const candidate of COMMON_DOMAINS) {
        const d = distance(domain, candidate);
        if (d < bestDistance) {
            bestDistance = d;
            best = candidate;
        }
    }

    return bestDistance <= 2 ? best : undefined;
}

const LOCAL_ALLOWED = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const DOMAIN_ALLOWED = /^[a-z0-9.-]+$/;

export function checkEmail(raw: string): checkEmail {
    const value = raw.trim();

    if (!value) return { state: 'empty' };
    // Only internal whitespace is a problem; surrounding space is trimmed above,
    // which matters because keyboards and paste routinely add a trailing space.
    if (/\s/.test(value)) {
        return { state: 'invalid', message: "An email address can't contain spaces." };
    }

    const at = value.indexOf('@');
    if (at === -1) {
        return { state: 'invalid', message: 'Add an @ — for example you@gmail.com.' };
    }
    if (value.indexOf('@', at + 1) !== -1) {
        return { state: 'invalid', message: 'Only one @ is allowed.' };
    }

    const local = value.slice(0, at);
    const domain = value.slice(at + 1).toLowerCase();

    if (!local) return { state: 'invalid', message: 'Add the part before the @.' };
    if (local.length > 64) return { state: 'invalid', message: 'The part before the @ is too long.' };
    if (!LOCAL_ALLOWED.test(local)) {
        return { state: 'invalid', message: "That uses characters an email address can't have." };
    }
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
        return { state: 'invalid', message: "Dots can't start, end, or repeat before the @." };
    }

    if (!domain) {
        return { state: 'invalid', message: 'Add a domain after the @ — for example gmail.com.' };
    }
    if (!DOMAIN_ALLOWED.test(domain)) {
        return { state: 'invalid', message: "That domain uses characters it can't have." };
    }
    if (!domain.includes('.')) {
        return { state: 'invalid', message: 'The domain needs a dot — for example gmail.com.' };
    }

    const labels = domain.split('.');
    if (labels.some((l) => !l || l.startsWith('-') || l.endsWith('-'))) {
        return { state: 'invalid', message: "That domain isn't formatted correctly." };
    }

    const tld = labels[labels.length - 1];
    if (!/^[a-z]{2,}$/.test(tld)) {
        return { state: 'invalid', message: 'The domain ending looks incomplete.' };
    }

    const normalized = `${local}@${domain}`;
    const suggestedDomain = suggestDomain(domain);

    return {
        state: 'valid',
        normalized,
        suggestion: suggestedDomain ? `${local}@${suggestedDomain}` : undefined,
    };
}