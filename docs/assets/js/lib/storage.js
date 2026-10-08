// Bezpieczny wrapper localStorage: tryb prywatny / zablokowane dane witryny nie mogą wywrócić aplikacji.
const memory = new Map();
function ls() {
    try {
        const s = window.localStorage;
        const k = '__ros_probe__';
        s.setItem(k, '1');
        s.removeItem(k);
        return s;
    }
    catch {
        return null;
    }
}
export const storage = {
    get(key) {
        const s = ls();
        if (!s)
            return memory.get(key) ?? null;
        try {
            return s.getItem(key);
        }
        catch {
            return memory.get(key) ?? null;
        }
    },
    set(key, value) {
        const s = ls();
        if (!s) {
            memory.set(key, value);
            return true;
        }
        try {
            s.setItem(key, value);
            return true;
        }
        catch {
            return false; // np. przekroczony limit — wywołujący zdecyduje, co dalej
        }
    },
    remove(key) {
        memory.delete(key);
        const s = ls();
        try {
            s?.removeItem(key);
        }
        catch {
            /* ignoruj */
        }
    },
    keys() {
        const s = ls();
        if (!s)
            return [...memory.keys()];
        const out = [];
        try {
            for (let i = 0; i < s.length; i++) {
                const k = s.key(i);
                if (k)
                    out.push(k);
            }
        }
        catch {
            /* ignoruj */
        }
        return out;
    },
    getJson(key, fallback) {
        const raw = this.get(key);
        if (!raw)
            return fallback;
        try {
            return JSON.parse(raw);
        }
        catch {
            return fallback;
        }
    },
    setJson(key, value) {
        return this.set(key, JSON.stringify(value));
    },
};
