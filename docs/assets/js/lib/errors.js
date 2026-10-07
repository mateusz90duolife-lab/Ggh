/** Błędy sieci/API tłumaczone na czytelne komunikaty po polsku. */
export class ApiError extends Error {
    status;
    code;
    constructor(status, code, message) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}
/** Brak połączenia z serwerem (fetch odrzucony). */
export class NetworkError extends Error {
    constructor() {
        super('Brak połączenia z internetem.');
        this.name = 'NetworkError';
    }
}
/** Komunikaty z naszych funkcji SQL (raise exception) są już po polsku — pokazujemy je wprost. */
export function fromPostgrest(status, body) {
    const code = body?.code ?? String(status);
    const msg = body?.message ?? '';
    if (status === 401 || code === 'PGRST301' || /jwt/i.test(msg)) {
        return new ApiError(401, code, 'Sesja wygasła. Zaloguj się ponownie.');
    }
    if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(msg)) {
        return new ApiError(403, code, 'Brak uprawnień do tej operacji.');
    }
    if (code === '23505')
        return new ApiError(409, code, 'Taki rekord już istnieje.');
    if (code === '23503')
        return new ApiError(409, code, 'Ten rekord jest używany w innym miejscu i nie można go zmienić.');
    if (code === '23514')
        return new ApiError(400, code, 'Wprowadzona wartość jest nieprawidłowa.');
    if (code === 'P0001' && msg)
        return new ApiError(400, code, msg);
    if (status >= 500)
        return new ApiError(status, code, 'Błąd serwera. Spróbuj ponownie za chwilę.');
    return new ApiError(status, code, msg || 'Nie udało się wykonać operacji.');
}
export function errorMessage(e) {
    if (e instanceof ApiError || e instanceof NetworkError)
        return e.message;
    if (e instanceof Error)
        return 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.';
    return 'Wystąpił nieoczekiwany błąd.';
}
export function isNetworkError(e) {
    return e instanceof NetworkError;
}
