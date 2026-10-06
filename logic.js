// Reine Berechnungslogik (ohne DOM), auch in Node testbar.
(function (root) {
  const H = 3600000, M = 60000;

  // Gesetzliche Mindestpause (DE): >6h -> 30 min, >9h -> 45 min
  function autoBreakMs(grossMs) {
    if (grossMs > 9 * H) return 45 * M;
    if (grossMs > 6 * H) return 30 * M;
    return 0;
  }

  // Abgezogene Pause = max(tatsächlich erfasst, automatisches Minimum)
  function breakMs(entry, settings, nowMs) {
    const end = entry.end ?? nowMs;
    const gross = Math.max(0, end - entry.start);
    const actual = (entry.breakMin || 0) * M;
    return Math.min(gross, settings.autoBreak ? Math.max(actual, autoBreakMs(gross)) : actual);
  }

  function netMs(entry, settings, nowMs) {
    const end = entry.end ?? nowMs;
    return Math.max(0, end - entry.start - breakMs(entry, settings, nowMs));
  }

  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function dayKey(ms) {
    const d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Montag der Woche (lokal)
  function weekStart(ms) {
    const d = new Date(ms); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }

  // Wochenplan. settings.days[i] (i=0 Mo ... 6 So): {work:bool, fixed:number|null (Stunden)}
  // Rückgabe: 7 Tage mit worked, plan (ms), isPast/isToday.
  function weekPlan(entries, settings, activeEntry, nowMs, anyDayInWeek) {
    const ws = weekStart(anyDayInWeek ?? nowMs);
    const today = startOfDay(nowMs);
    const all = activeEntry ? entries.concat([{ ...activeEntry, end: null }]) : entries;
    const days = [];
    for (let i = 0; i < 7; i++) {
      const start = addDays(ws, i), end = addDays(ws, i + 1);
      let worked = 0;
      for (const e of all) if (e.start >= start && e.start < end) worked += netMs(e, settings, nowMs);
      const cfg = settings.days[i] || { work: false, fixed: null };
      days.push({ index: i, start, worked, work: cfg.work, fixed: cfg.fixed, isPast: start < today, isToday: start === today, plan: 0, auto: false });
    }
    const targetMs = settings.targetHours * H;
    const workedBefore = days.filter(d => d.isPast).reduce((s, d) => s + d.worked, 0);
    const future = days.filter(d => !d.isPast && d.work);
    const fixedFuture = future.filter(d => d.fixed != null);
    const free = future.filter(d => d.fixed == null);
    const fixedTotal = fixedFuture.reduce((s, d) => s + d.fixed * H, 0);
    const remaining = Math.max(0, targetMs - workedBefore - fixedTotal);
    const share = free.length ? remaining / free.length : 0;
    for (const d of days) {
      if (d.isPast) d.plan = d.work ? (d.fixed != null ? d.fixed * H : 0) : 0;
      else if (!d.work) d.plan = 0;
      else if (d.fixed != null) d.plan = d.fixed * H;
      else { d.plan = share; d.auto = true; }
    }
    const worked = days.reduce((s, d) => s + d.worked, 0);
    const plannedFuture = future.reduce((s, d) => s + d.plan, 0);
    return {
      weekStart: ws, days, targetMs, worked, left: targetMs - worked,
      // Plan reicht nicht aus, um die Wochenstunden zu erreichen (keine freien Tage übrig)
      shortfall: free.length === 0 && workedBefore + plannedFuture < targetMs - M ? targetMs - workedBefore - plannedFuture : 0,
    };
  }

  const api = { H, M, autoBreakMs, breakMs, netMs, startOfDay, dayKey, weekStart, addDays, weekPlan };
  if (typeof module !== 'undefined') module.exports = api; else root.Logic = api;
})(typeof self !== 'undefined' ? self : this);
