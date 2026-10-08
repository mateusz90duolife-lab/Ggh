export function decodeJwt(token) {
    try {
        const part = token.split('.')[1];
        if (!part)
            return null;
        const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const json = decodeURIComponent(atob(padded)
            .split('')
            .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join(''));
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
