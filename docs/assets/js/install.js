let deferred = null;
const listeners = new Set();
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
});
export function onInstallChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
export function isStandalone() {
    return (window.matchMedia?.('(display-mode: standalone)').matches ||
        navigator.standalone === true);
}
export function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
export function canPromptInstall() {
    return deferred !== null && !isStandalone();
}
export async function promptInstall() {
    if (!deferred)
        return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    deferred = null;
    listeners.forEach((l) => l());
    return choice.outcome === 'accepted';
}
