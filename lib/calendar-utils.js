'use strict';

/**
 * Calendar & Recurrence Utilities for Jadwal Meeting & Google Calendar Views
 * Supports:
 * - Daily View (Harian)
 * - Weekly View (Mingguan) as seen in Google Calendar (SEN 28, SEL 29, ..., SAB 3)
 * - Monthly View (Bulanan)
 * - Recurrence matching: Sekali Saja (Once), Mingguan (Weekly XXX), Bulanan (Monthly X), Harian (Daily)
 */

export const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS_SHORT_ID = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];

// Monday-first days of week
export const DAYS_OF_WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const DAYS_OF_WEEK_SHORT = ['SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB', 'MIN'];

export const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MONTHS_SHORT_ID = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

/**
 * Format a Date to YYYY-MM-DD
 */
export const formatDateYMD = (date) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/**
 * Parse YYYY-MM-DD string to Date object at local midnight
 */
export const parseDateYMD = (ymdStr) => {
    if (!ymdStr) return new Date();
    const [y, m, d] = String(ymdStr).split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d, 0, 0, 0, 0);
};

/**
 * Get Indonesian day name for a Date
 */
export const getDayNameID = (date) => {
    const d = new Date(date);
    return DAYS_ID[d.getDay()] || 'Senin';
};

/**
 * Get Indonesian short day name (e.g. SEN, SEL, RAB...)
 */
export const getDayShortID = (date) => {
    const d = new Date(date);
    return DAYS_SHORT_ID[d.getDay()] || 'SEN';
};

/**
 * Check if two dates are on the exact same day
 */
export const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
};

/**
 * Check if a date is today
 */
export const isTodayDate = (date) => {
    return isSameDay(date, new Date());
};

/**
 * Get Monday of the week containing the given date
 */
export const getStartOfWeekMonday = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
};

/**
 * Get 7 days array for the week containing the given date (Monday to Sunday)
 */
export const getWeekDays = (referenceDate) => {
    const monday = getStartOfWeekMonday(referenceDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        days.push({
            date: d,
            dateStr: formatDateYMD(d),
            dayNumber: d.getDate(),
            dayName: DAYS_OF_WEEK[i],
            dayShort: DAYS_OF_WEEK_SHORT[i],
            isToday: isTodayDate(d)
        });
    }
    return days;
};

/**
 * Get calendar matrix for monthly view (35 or 42 days)
 */
export const getMonthGrid = (year, monthIndex) => {
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    
    // Day of week for 1st of month (0 is Sunday, convert so Monday is 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6; // Sunday becomes 6

    const days = [];
    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const d = new Date(year, monthIndex, -i);
        days.push({
            date: d,
            dateStr: formatDateYMD(d),
            dayNumber: d.getDate(),
            isCurrentMonth: false,
            isToday: isTodayDate(d),
            dayName: DAYS_ID[d.getDay()]
        });
    }

    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const d = new Date(year, monthIndex, i);
        days.push({
            date: d,
            dateStr: formatDateYMD(d),
            dayNumber: i,
            isCurrentMonth: true,
            isToday: isTodayDate(d),
            dayName: DAYS_ID[d.getDay()]
        });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(year, monthIndex + 1, i);
        days.push({
            date: d,
            dateStr: formatDateYMD(d),
            dayNumber: i,
            isCurrentMonth: false,
            isToday: isTodayDate(d),
            dayName: DAYS_ID[d.getDay()]
        });
    }

    return days;
};

/**
 * Parse recurrence configuration from schedule item
 * Gracefully extracts from scheduleItem.recurrence, scheduleItem.notes (JSON), or falls back to legacy schedule.day
 */
export const parseScheduleRecurrence = (item) => {
    if (!item) return { type: 'weekly', days: ['Senin'] };

    // 1. If explicit recurrence object already on item
    if (item.recurrence && typeof item.recurrence === 'object') {
        const rec = item.recurrence;
        return {
            type: rec.type || 'weekly',
            days: Array.isArray(rec.days) && rec.days.length > 0 ? rec.days : [item.day || 'Senin'],
            date: rec.date || item.date || item.schedule_date || null,
            monthlyType: rec.monthlyType || 'date', // 'date' (tgl X) or 'day_of_week' (hari ke-N)
            dayOfMonth: Number(rec.dayOfMonth) || (item.date ? new Date(item.date).getDate() : 1),
            weekNumber: rec.weekNumber || 1, // 1, 2, 3, 4, or 'last'
            dayOfWeek: rec.dayOfWeek || item.day || 'Senin',
            weekdaysOnly: Boolean(rec.weekdaysOnly)
        };
    }

    // 2. Check if embedded in notes as JSON string
    if (typeof item.notes === 'string' && item.notes.trim().startsWith('{') && item.notes.trim().endsWith('}')) {
        try {
            const parsed = JSON.parse(item.notes);
            if (parsed && parsed.recurrence) {
                return parseScheduleRecurrence({
                    ...item,
                    recurrence: parsed.recurrence,
                    date: parsed.date || item.date
                });
            }
        } catch (e) {}
    }

    // 3. If item has a specific date set
    if (item.date || item.schedule_date) {
        return {
            type: 'once',
            days: [item.day || getDayNameID(item.date || item.schedule_date)],
            date: item.date || item.schedule_date,
            monthlyType: 'date',
            dayOfMonth: new Date(item.date || item.schedule_date).getDate(),
            weekNumber: 1,
            dayOfWeek: item.day || 'Senin',
            weekdaysOnly: false
        };
    }

    // 4. Default legacy: weekly recurring on item.day
    return {
        type: 'weekly',
        days: [item.day || 'Senin'],
        date: null,
        monthlyType: 'date',
        dayOfMonth: 1,
        weekNumber: 1,
        dayOfWeek: item.day || 'Senin',
        weekdaysOnly: false
    };
};

/**
 * Format readable human badge for recurrence
 * e.g. "Mingguan: Setiap Rabu", "Bulanan: Setiap Tgl 15", "Sekali Saja"
 */
export const formatRecurrenceLabel = (item) => {
    const rec = parseScheduleRecurrence(item);
    if (rec.type === 'once') {
        if (rec.date) {
            const d = parseDateYMD(rec.date);
            return `Sekali saja (${d.getDate()} ${MONTHS_SHORT_ID[d.getMonth()]})`;
        }
        return 'Sekali saja';
    }
    if (rec.type === 'weekly') {
        const days = Array.isArray(rec.days) && rec.days.length > 0 ? rec.days : [item.day || 'Senin'];
        return `Mingguan (Setiap ${days.join(', ')})`;
    }
    if (rec.type === 'monthly') {
        if (rec.monthlyType === 'day_of_week') {
            const weekStr = rec.weekNumber === 'last' ? 'Terakhir' : `Ke-${rec.weekNumber}`;
            return `Bulanan (${rec.dayOfWeek} ${weekStr})`;
        }
        return `Bulanan (Setiap Tgl ${rec.dayOfMonth})`;
    }
    if (rec.type === 'daily') {
        return rec.weekdaysOnly ? 'Hari Kerja (Senin - Jumat)' : 'Setiap Hari';
    }
    return 'Mingguan';
};

/**
 * Check if a schedule occurs on a given target Date (Date object or YYYY-MM-DD string)
 */
export const isScheduleActiveOnDate = (item, targetDateInput) => {
    if (!item) return false;
    const targetDate = typeof targetDateInput === 'string' ? parseDateYMD(targetDateInput) : new Date(targetDateInput);
    if (isNaN(targetDate.getTime())) return false;

    const targetYMD = formatDateYMD(targetDate);
    const targetDayName = DAYS_ID[targetDate.getDay()];
    const targetDayOfMonth = targetDate.getDate();

    const rec = parseScheduleRecurrence(item);

    // 1. One-time schedule
    if (rec.type === 'once') {
        if (rec.date) {
            return rec.date === targetYMD;
        }
        // Fallback for legacy items with created_at date
        if (item.createdAt || item.created_at) {
            return formatDateYMD(item.createdAt || item.created_at) === targetYMD;
        }
        return false;
    }

    // 2. Weekly schedule (e.g. "Mingguan setiap hari XXX")
    if (rec.type === 'weekly') {
        const days = Array.isArray(rec.days) && rec.days.length > 0 ? rec.days : [item.day || 'Senin'];
        return days.some(d => String(d).trim().toLowerCase() === targetDayName.toLowerCase());
    }

    // 3. Monthly schedule (e.g. "Bulanan setiap tgl X" or "Setiap hari X ke-N")
    if (rec.type === 'monthly') {
        if (rec.monthlyType === 'day_of_week') {
            if (String(rec.dayOfWeek).trim().toLowerCase() !== targetDayName.toLowerCase()) {
                return false;
            }
            // Check week occurrence in month (1st, 2nd, 3rd, 4th, or last)
            const occurrence = Math.ceil(targetDayOfMonth / 7);
            if (rec.weekNumber === 'last') {
                const nextWeekDate = new Date(targetDate);
                nextWeekDate.setDate(targetDate.getDate() + 7);
                return nextWeekDate.getMonth() !== targetDate.getMonth();
            }
            return occurrence === Number(rec.weekNumber);
        }
        // By date of month (e.g. every 15th)
        return targetDayOfMonth === Number(rec.dayOfMonth);
    }

    // 4. Daily schedule
    if (rec.type === 'daily') {
        if (rec.weekdaysOnly) {
            const d = targetDate.getDay();
            return d >= 1 && d <= 5; // Monday to Friday
        }
        return true;
    }

    // 5. Fallback check on item.day
    if (item.day && String(item.day).trim().toLowerCase() === targetDayName.toLowerCase()) {
        return true;
    }

    return false;
};

/**
 * Format time string 'HH:mm' to minutes from midnight
 */
export const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = String(timeStr).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

/**
 * Format minutes from midnight to 'HH:mm'
 */
export const minutesToTime = (min) => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, min));
    const h = String(Math.floor(clamped / 60)).padStart(2, '0');
    const m = String(clamped % 60).padStart(2, '0');
    return `${h}:${m}`;
};

/**
 * Format local time zone string (e.g. "GMT+08")
 */
export const getLocalTimezoneLabel = () => {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    const mins = Math.abs(offsetMin) % 60;
    if (mins === 0) {
        return `GMT${sign}${String(hours).padStart(2, '0')}`;
    }
    return `GMT${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};
