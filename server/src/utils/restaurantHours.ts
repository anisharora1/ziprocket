export function isWithinOperatingHours(open?: string, close?: string, now: Date = new Date()): boolean {
    if (!open || !close) return true;
    const [openH, openM] = open.split(":").map(Number);
    const [closeH, closeM] = close.split(":").map(Number);
    if (isNaN(openH) || isNaN(closeH)) return true;

    // Use Asia/Kolkata timezone to determine current hours and minutes
    const options = { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' } as const;
    const timeString = new Intl.DateTimeFormat('en-US', options).format(now);
    const cleanTime = timeString.replace(/[^\d:]/g, '');
    const [currH, currM] = cleanTime.split(":").map(Number);

    const currentMinutes = (!isNaN(currH) ? currH : now.getHours()) * 60 + (!isNaN(currM) ? currM : now.getMinutes());
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);

    if (closeMinutes <= openMinutes) {
        // Overnight hours (e.g. open 18:00, close 02:00) — wraps past midnight
        return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}
