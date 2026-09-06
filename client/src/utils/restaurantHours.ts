export function isWithinOperatingHours(open?: string, close?: string, now: Date = new Date()): boolean {
    if (!open || !close) return true;
    const cleanOpen = open.replace(/[^\d:]/g, '');
    const cleanClose = close.replace(/[^\d:]/g, '');
    const [openH, openM] = cleanOpen.split(":").map(Number);
    const [closeH, closeM] = cleanClose.split(":").map(Number);
    if (isNaN(openH) || isNaN(closeH)) return true;

    try {
        const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
        const timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
        const cleanTime = timeStr.replace(/[^\d:]/g, '');
        const [currH, currM] = cleanTime.split(":").map(Number);

        const currentMinutes = (!isNaN(currH) ? currH : now.getHours()) * 60 + (!isNaN(currM) ? currM : now.getMinutes());
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);

        if (closeMinutes <= openMinutes) {
            // Overnight hours (e.g. open 18:00, close 02:00) — wraps past midnight
            return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
        }
        return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } catch {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const openMinutes = openH * 60 + (openM || 0);
        const closeMinutes = closeH * 60 + (closeM || 0);
        if (closeMinutes <= openMinutes) {
            return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
        }
        return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }
}

export function formatToAMPM(timeStr?: string): string {
    if (!timeStr) return "";
    const cleanTime = timeStr.replace(/[^\d:]/g, '');
    const [h, m] = cleanTime.split(":").map(Number);
    if (isNaN(h)) return "";
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    const displayM = (m || 0).toString().padStart(2, '0');
    return `${displayH}:${displayM} ${ampm}`;
}
