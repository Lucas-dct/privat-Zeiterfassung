(() => {
  const L = Logic, KEY = 'zeiterfassung.v1';
  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const DAYS_LONG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const defaults = () => ({
    settings: { targetHours: 35, autoBreak: true, days: [0, 1, 2, 3, 4, 5, 6].map(i => ({ work: i < 5, fixed: null })) },
    active: null, // {start, breakMin, breakStart|null}
    entries: [],  // {id, start, end, breakMin}
  });
  let state = load(), tab = 'today', weekOffset = 0;

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.settings) return Object.assign(defaults(), s); } catch (e) {}
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('Speichern nicht möglich (Speicher voll oder gesperrt).'); } }

  // ---------- Format ----------
  const p2 = n => String(n).padStart(2, '0');
  function hm(ms) { const m = Math.round(Math.abs(ms) / 60000); return (ms < 0 ? '−' : '') + Math.floor(m / 60) + ':' + p2(m % 60) + ' h'; }
  function hms(ms) { const s = Math.floor(Math.max(0, ms) / 1000); return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60); }
  const clock = ms => { const d = new Date(ms); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const dateStr = ms => new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const toLocalInput = ms => { const d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };

  // ---------- Active session helpers ----------
  function activeEntry(now) {
    const a = state.active; if (!a) return null;
    const extra = a.breakStart ? Math.floor((now - a.breakStart) / 60000) : 0;
    return { start: a.start, end: null, breakMin: (a.breakMin || 0) + extra };
  }
  const plan = (now, anyDay) => L.weekPlan(state.entries, state.settings, activeEntry(now), now, anyDay);

  // ---------- Actions ----------
  const actions = {
    start() { state.active = { start: Date.now(), breakMin: 0, breakStart: null }; save(); render(); },
    pause() { state.active.breakStart = Date.now(); save(); render(); },
    resume() {
      const a = state.active; a.breakMin = (a.breakMin || 0) + (Date.now() - a.breakStart) / 60000; a.breakStart = null; save(); render();
    },
    stop() {
      const a = state.active, now = Date.now();
      if (a.breakStart) { a.breakMin += (now - a.breakStart) / 60000; }
      state.entries.push({ id: now, start: a.start, end: now, breakMin: Math.round(a.breakMin) });
      state.active = null; save(); render();
    },
    discard() { if (confirm('Laufende Zeiterfassung verwerfen?')) { state.active = null; save(); render(); } },
  };

  // ---------- Views ----------
  function viewToday(now) {
    const a = state.active, ae = activeEntry(now), P = plan(now), td = P.days.find(d => d.isToday);
    let h = '<h1>Heute</h1><div class="card">';
    if (a) {
      const net = L.netMs(ae, state.settings, now), onBreak = !!a.breakStart;
      h += `<div class="mute center">${onBreak ? 'Pause läuft seit ' + clock(a.breakStart) : 'Gestartet um ' + clock(a.start)}</div>
        <div class="big" id="clock">${hms(net)}</div>
        <div class="mute center">Netto-Arbeitszeit · Pause: ${Math.round(L.breakMs(ae, state.settings, now) / 60000)} min${state.settings.autoBreak && L.breakMs(ae, state.settings, now) > (ae.breakMin * 60000) ? ' (inkl. gesetzl. Mindestpause)' : ''}</div>
        <div class="btns">${onBreak ? '<button class="pri" data-a="resume">Pause beenden</button>' : '<button data-a="pause">Pause starten</button>'}
        <button class="pri" data-a="stop">Feierabend</button></div>
        <div class="btns"><button class="danger" data-a="discard">Verwerfen</button></div>`;
    } else {
      h += `<div class="big">${clock(now)}</div><div class="btns"><button class="pri" data-a="start">Arbeit starten</button></div>`;
    }
    h += '</div>';
    if (td) {
      const left = td.plan - td.worked;
      h += `<div class="card"><h2>Tagesziel</h2>
        <div class="row"><span>Geplant${td.auto ? ' (automatisch)' : ''}</span><b>${hm(td.plan)}</b></div>
        <div class="row"><span>Gearbeitet</span><b>${hm(td.worked)}</b></div>
        <div class="row"><span>${left >= 0 ? 'Noch offen' : 'Mehr als geplant'}</span><b class="${left < 0 ? 'warn' : ''}">${hm(Math.abs(left))}</b></div>
        ${a && !a.breakStart && left > 0 ? `<div class="mute">Voraussichtlich Feierabend um ${clock(now + left)}</div>` : ''}</div>`;
    }
    h += weekSummary(P);
    return h;
  }

  function weekSummary(P) {
    const pct = Math.min(100, P.targetMs ? P.worked / P.targetMs * 100 : 0);
    return `<div class="card"><h2>Woche</h2><div class="row"><span>${hm(P.worked)} von ${hm(P.targetMs)}</span>
      <b class="${P.left < 0 ? 'warn' : ''}">${P.left >= 0 ? 'noch ' + hm(P.left) : '+' + hm(-P.left)}</b></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${P.shortfall ? `<p class="warn">Mit diesem Plan fehlen ${hm(P.shortfall)} zur Wochenstunden-Zahl. Erhöhe einen festen Tag oder gib ihn frei.</p>` : ''}</div>`;
  }

  function viewWeek(now) {
    const ref = L.addDays(L.weekStart(now), weekOffset * 7), P = plan(now, ref);
    const end = L.addDays(P.weekStart, 6);
    let h = `<div class="nav"><button data-a="wprev" aria-label="Vorherige Woche">‹</button>
      <h1 style="margin:0">${dateStr(P.weekStart).split(', ')[1]} – ${dateStr(end).split(', ')[1]}</h1>
      <button data-a="wnext" aria-label="Nächste Woche">›</button></div>`;
    h += weekSummary(P) + '<div class="card"><h2>Planer</h2>';
    for (const d of P.days) {
      if (!d.work && d.worked === 0) continue;
      h += `<div class="day ${d.isToday ? 'today' : ''}"><div>${DAYS_LONG[d.index]}<div class="mute">${d.fixed != null ? 'fest ' + hm(d.fixed * L.H) : d.work ? (d.auto ? 'automatisch' : '') : 'frei'}</div></div>
        <div class="r">${d.isPast || d.isToday ? hm(d.worked) + ' ' : ''}${d.work ? `<div class="mute">Soll ${hm(d.plan)}</div>` : ''}</div></div>`;
    }
    h += '<p class="mute">Feste Tage (z. B. Freitag 5 h) stellst du unter „Einstellungen“ ein. Die restlichen Stunden werden automatisch auf die übrigen Arbeitstage verteilt, auf Basis dessen, was schon gearbeitet wurde.</p></div>';
    return h;
  }

  function viewLog(now) {
    const list = state.entries.slice().sort((a, b) => b.start - a.start);
    let h = '<h1>Einträge</h1><div class="btns" style="margin:0 0 12px"><button class="pri" data-a="add">Eintrag hinzufügen</button></div><div class="card">';
    if (!list.length) h += '<p class="mute">Noch keine Einträge. Starte oben auf „Heute“ die Zeiterfassung oder füge einen Eintrag manuell hinzu.</p>';
    for (const e of list) {
      h += `<div class="day"><div>${dateStr(e.start)}<div class="mute">${clock(e.start)}–${clock(e.end)} · Pause ${Math.round(L.breakMs(e, state.settings) / 60000)} min</div></div>
        <div class="r"><b>${hm(L.netMs(e, state.settings))}</b><div><button data-a="edit" data-id="${e.id}" style="min-height:32px;padding:0 10px">Ändern</button></div></div></div>`;
    }
    return h + '</div>';
  }

  function viewSettings() {
    const s = state.settings;
    let h = `<h1>Einstellungen</h1><div class="card"><label for="target">Wochenstunden</label>
      <input id="target" inputmode="decimal" value="${s.targetHours}" data-set="target">
      <label class="chk" style="margin-top:14px"><input type="checkbox" data-set="autoBreak" ${s.autoBreak ? 'checked' : ''}> Gesetzliche Mindestpause automatisch abziehen</label>
      <p class="mute">Mehr als 6 h Arbeit: 30 min, mehr als 9 h: 45 min. Hast du mehr Pause gemacht, zählt die tatsächliche Pause.</p></div>
      <div class="card"><h2>Arbeitstage</h2><p class="mute">Haken = Arbeitstag. Feste Stunden optional (z. B. Freitag 5). Leer = automatisch verteilt.</p>`;
    for (let i = 0; i < 7; i++) {
      const d = s.days[i];
      h += `<div class="dayset"><span>${DAYS[i]}</span><label class="chk"><input type="checkbox" data-day="${i}" data-f="work" ${d.work ? 'checked' : ''} aria-label="${DAYS_LONG[i]} Arbeitstag"> Arbeitstag</label>
        <input inputmode="decimal" placeholder="auto" data-day="${i}" data-f="fixed" value="${d.fixed ?? ''}" ${d.work ? '' : 'disabled'} aria-label="${DAYS_LONG[i]} feste Stunden"></div>`;
    }
    h += `</div><div class="card"><h2>Daten</h2><p class="mute">Alles liegt nur auf diesem Handy. Sichere es regelmäßig.</p>
      <div class="btns"><button data-a="csv">CSV exportieren</button><button data-a="json">Backup speichern</button></div>
      <div class="btns"><button data-a="import">Backup laden</button></div><input type="file" id="file" accept=".json" hidden></div>`;
    return h;
  }

  const views = { today: viewToday, week: viewWeek, log: viewLog, settings: viewSettings };
  const $view = document.getElementById('view');

  function render() {
    if (document.activeElement && document.activeElement.matches('#view input')) return; // Eingabe nicht überschreiben
    $view.innerHTML = views[tab](Date.now());
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  }

  // ---------- Dialog für Einträge ----------
  function editDialog(entry) {
    const isNew = !entry;
    const e = entry || { start: new Date().setHours(8, 0, 0, 0), end: new Date().setHours(16, 0, 0, 0), breakMin: 30 };
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><h2>${isNew ? 'Eintrag hinzufügen' : 'Eintrag ändern'}</h2>
      <label for="d-s">Start</label><input type="datetime-local" id="d-s" value="${toLocalInput(e.start)}" required>
      <label for="d-e">Ende</label><input type="datetime-local" id="d-e" value="${toLocalInput(e.end)}" required>
      <label for="d-b">Pause (Minuten)</label><input id="d-b" inputmode="numeric" value="${e.breakMin || 0}">
      <p class="bad" id="d-err" role="alert"></p>
      <div class="btns"><button value="cancel">Abbrechen</button><button class="pri" value="ok">Speichern</button></div>
      ${isNew ? '' : '<div class="btns"><button class="danger" value="del">Eintrag löschen</button></div>'}</form>`;
    document.body.appendChild(dlg);
    dlg.querySelector('form').addEventListener('submit', ev => {
      const v = ev.submitter && ev.submitter.value;
      if (v === 'del') { if (!confirm('Diesen Eintrag löschen?')) { ev.preventDefault(); return; } state.entries = state.entries.filter(x => x.id !== e.id); }
      else if (v === 'ok') {
        const s = new Date(dlg.querySelector('#d-s').value).getTime(), en = new Date(dlg.querySelector('#d-e').value).getTime();
        const b = Math.max(0, Math.round(num(dlg.querySelector('#d-b').value) || 0));
        if (!(en > s)) { ev.preventDefault(); dlg.querySelector('#d-err').textContent = 'Das Ende muss nach dem Start liegen.'; return; }
        if (isNew) state.entries.push({ id: Date.now(), start: s, end: en, breakMin: b });
        else Object.assign(state.entries.find(x => x.id === e.id), { start: s, end: en, breakMin: b });
      } else return;
      save();
    });
    dlg.addEventListener('close', () => { dlg.remove(); render(); });
    dlg.showModal();
  }

  // ---------- Export / Import ----------
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() {
    const rows = ['Datum;Start;Ende;Pause (min);Netto (h)'];
    for (const e of state.entries.slice().sort((a, b) => a.start - b.start))
      rows.push([L.dayKey(e.start), clock(e.start), clock(e.end), Math.round(L.breakMs(e, state.settings) / 60000), (L.netMs(e, state.settings) / L.H).toFixed(2).replace('.', ',')].join(';'));
    download('zeiterfassung.csv', '﻿' + rows.join('\r\n'), 'text/csv');
  }

  // ---------- Events ----------
  document.getElementById('tabs').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return; tab = t.dataset.tab; weekOffset = 0; render();
  });
  $view.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return; const a = b.dataset.a;
    if (actions[a]) actions[a]();
    else if (a === 'wprev') { weekOffset--; render(); }
    else if (a === 'wnext') { weekOffset++; render(); }
    else if (a === 'add') editDialog();
    else if (a === 'edit') editDialog(state.entries.find(x => x.id === +b.dataset.id));
    else if (a === 'csv') exportCsv();
    else if (a === 'json') download('zeiterfassung-backup.json', JSON.stringify(state, null, 1), 'application/json');
    else if (a === 'import') document.getElementById('file').click();
  });
  $view.addEventListener('change', e => {
    const t = e.target, s = state.settings;
    if (t.id === 'file') {
      const f = t.files[0]; if (!f) return;
      f.text().then(txt => {
        const d = JSON.parse(txt);
        if (!d || !d.settings || !Array.isArray(d.entries)) throw 0;
        if (confirm('Backup laden? Die aktuellen Daten auf diesem Gerät werden ersetzt.')) { state = Object.assign(defaults(), d); save(); render(); }
      }).catch(() => alert('Die Datei ist kein gültiges Backup.'));
      return;
    }
    if (t.dataset.set === 'target') { const n = num(t.value); if (n > 0 && n <= 80) s.targetHours = n; t.value = s.targetHours; }
    else if (t.dataset.set === 'autoBreak') s.autoBreak = t.checked;
    else if (t.dataset.day != null) {
      const d = s.days[+t.dataset.day];
      if (t.dataset.f === 'work') d.work = t.checked;
      else { const n = num(t.value); d.fixed = n != null && n >= 0 && n <= 24 ? n : null; }
    } else return;
    save(); t.blur(); render();
  });

  // Laufende Anzeige jede Sekunde nur aktualisieren, wenn etwas läuft
  setInterval(() => { if (state.active && tab === 'today') render(); }, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
