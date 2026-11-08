import { put, list, del } from '@vercel/blob';
import crypto from 'node:crypto';

const ID_RE = /^[a-z0-9]{6,20}$/;
const CURS = ['ILS', 'USD', 'EUR'];
const APP_V = '7';
const ALPHA = 'abcdefghijkmnpqrstuvwxyz23456789';

function rid(n = 10) {
  const b = crypto.randomBytes(n);
  let s = '';
  for (const x of b) s += ALPHA[x % ALPHA.length];
  return s;
}
const newRev = () => String(Date.now()).padStart(15, '0') + rid(4);
const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const round4 = (x) => Math.round(x * 10000) / 10000;

function parseDays(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = Math.round(Number(v) * 2) / 2;
  if (!(d > 0 && d <= 365)) fail('מספר ימים לא תקין');
  return d;
}

class UserError extends Error {}
const fail = (m) => { throw new UserError(m); };

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

async function writeVersioned(t, key, obj) {
  const rev = newRev();
  const base = `trips/${t}/${key}/`;
  await put(base + rev + '.json', JSON.stringify(obj), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'application/json',
  });
  // Remove only older revisions, so concurrent writers never delete a newer one.
  const old = (await listAll(base)).filter((b) => {
    const r = b.pathname.slice(base.length).replace(/\.json$/, '');
    return !r.includes('/') && r < rev;
  });
  if (old.length) await del(old.map((b) => b.url));
}

async function removeKey(t, key) {
  const blobs = await listAll(`trips/${t}/${key}/`);
  if (blobs.length) await del(blobs.map((b) => b.url));
}

async function loadTrip(t) {
  const root = `trips/${t}/`;
  const blobs = await listAll(root);
  const latest = new Map();
  for (const bl of blobs) {
    const p = bl.pathname.slice(root.length).replace(/\.json$/, '').split('/');
    let key, rev;
    if (p[0] === 'meta' && p.length === 2) { key = 'meta'; rev = p[1]; }
    else if ((p[0] === 'm' || p[0] === 'e') && p.length === 3) { key = p[0] + '/' + p[1]; rev = p[2]; }
    else continue;
    const cur = latest.get(key);
    if (!cur || rev > cur.rev) latest.set(key, { rev, url: bl.url });
  }
  const entries = [...latest.entries()];
  const vals = await Promise.all(
    entries.map(([, v]) =>
      fetch(v.url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    )
  );
  const trip = { v: APP_V, meta: null, members: [], expenses: [] };
  entries.forEach(([k], i) => {
    const v = vals[i];
    if (!v) return;
    if (k === 'meta') trip.meta = v;
    else if (k[0] === 'm') trip.members.push(v);
    else trip.expenses.push(v);
  });
  trip.members.sort((a, b) => a.joinedAt - b.joinedAt);
  trip.expenses.sort((a, b) => b.createdAt - a.createdAt);
  return trip;
}

async function fetchRates() {
  const urls = [
    'https://api.frankfurter.dev/v1/latest?base=ILS&symbols=USD,EUR',
    'https://api.frankfurter.app/latest?from=ILS&to=USD,EUR',
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      const j = await r.json();
      if (j?.rates?.USD && j?.rates?.EUR) {
        return { ok: true, date: j.date, rates: { ILS: 1, USD: round4(1 / j.rates.USD), EUR: round4(1 / j.rates.EUR) } };
      }
    } catch (e) { /* try next */ }
  }
  return { ok: false, date: null, rates: { ILS: 1, USD: 3.7, EUR: 4.0 } };
}

function isReferenced(trip, mid) {
  return trip.expenses.some((e) => e.paidBy === mid || (Array.isArray(e.split) && e.split.includes(mid)));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (req.query.rates) return res.status(200).json(await fetchRates());
      const t = String(req.query.t || '');
      if (!ID_RE.test(t)) fail('קישור לא תקין');
      const trip = await loadTrip(t);
      if (!trip.meta) return res.status(404).json({ error: 'הטיול לא נמצא' });
      return res.status(200).json(trip);
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    let b = req.body;
    if (typeof b === 'string') b = JSON.parse(b || '{}');
    b = b || {};
    const now = Date.now();

    if (b.action === 'create') {
      const name = str(b.name, 60) || 'הטיול שלנו';
      const base = CURS.includes(b.base) ? b.base : 'ILS';
      const memberName = str(b.memberName, 30);
      if (!memberName) fail('חסר שם');
      const t = rid(10);
      const mid = rid(10);
      const rates = await fetchRates();
      await writeVersioned(t, 'meta', {
        name, base, ilsPer: rates.rates, ratesDate: rates.date, ratesAuto: rates.ok, hub: null, createdAt: now,
      });
      await writeVersioned(t, 'm/' + mid, { id: mid, name: memberName, joinedAt: now });
      return res.status(200).json({ t, memberId: mid, trip: await loadTrip(t) });
    }

    const t = String(b.t || '');
    if (!ID_RE.test(t)) fail('קישור לא תקין');
    const trip = await loadTrip(t);
    if (!trip.meta) return res.status(404).json({ error: 'הטיול לא נמצא' });
    const memberIds = new Set(trip.members.map((m) => m.id));
    let extra = {};

    switch (b.action) {
      case 'addMember': {
        const name = str(b.name, 30);
        if (!name) fail('חסר שם');
        if (trip.members.length >= 60) fail('יותר מדי חברים');
        const mid = rid(10);
        await writeVersioned(t, 'm/' + mid, { id: mid, name, joinedAt: now, days: parseDays(b.days) });
        extra.memberId = mid;
        break;
      }
      case 'renameMember': {
        const m = trip.members.find((x) => x.id === b.id);
        const name = str(b.name, 30);
        if (!m) fail('חבר לא נמצא');
        if (!name) fail('חסר שם');
        await writeVersioned(t, 'm/' + m.id, { ...m, name });
        break;
      }
      case 'setDays': {
        const m = trip.members.find((x) => x.id === b.id);
        if (!m) fail('חבר לא נמצא');
        await writeVersioned(t, 'm/' + m.id, { ...m, days: parseDays(b.days) });
        break;
      }
      case 'removeMember': {
        if (!memberIds.has(b.id)) fail('חבר לא נמצא');
        if (isReferenced(trip, b.id)) fail('אי אפשר להסיר — החבר מופיע בהוצאות');
        if (trip.members.length <= 1) fail('חייב להישאר לפחות חבר אחד');
        await removeKey(t, 'm/' + b.id);
        break;
      }
      case 'saveExpense': {
        const e = b.expense || {};
        const existing = e.id ? trip.expenses.find((x) => x.id === e.id) : null;
        if (e.id && !existing) fail('ההוצאה לא נמצאה (אולי נמחקה)');
        if (!existing && trip.expenses.length >= 1000) fail('יותר מדי הוצאות');
        const description = str(e.description, 80);
        const amount = Math.round(Number(e.amount) * 100) / 100;
        if (!description) fail('חסר תיאור');
        if (!(amount > 0 && amount < 1e8)) fail('סכום לא תקין');
        const currency = CURS.includes(e.currency) ? e.currency : trip.meta.base;
        if (!memberIds.has(e.paidBy)) fail('בחר מי שילם');
        let split;
        if (e.split === 'all') split = 'all';
        else if (Array.isArray(e.split)) {
          split = [...new Set(e.split.filter((id) => memberIds.has(id)))];
          if (!split.length) fail('בחר לפחות משתתף אחד');
        } else fail('בחר משתתפים');
        const id = existing ? existing.id : rid(10);
        await writeVersioned(t, 'e/' + id, {
          id, description, amount, currency, paidBy: e.paidBy, split,
          byDays: typeof e.byDays === 'boolean' ? e.byDays : split === 'all',
          createdAt: existing ? existing.createdAt : now,
          createdBy: existing ? existing.createdBy : (memberIds.has(b.by) ? b.by : null),
          updatedAt: now,
        });
        break;
      }
      case 'deleteExpense': {
        if (!trip.expenses.find((x) => x.id === b.id)) fail('ההוצאה לא נמצאה');
        await removeKey(t, 'e/' + b.id);
        break;
      }
      case 'updateMeta': {
        const m = { ...trip.meta };
        const p = b.meta || {};
        if ('name' in p) m.name = str(p.name, 60) || m.name;
        if ('base' in p && CURS.includes(p.base)) m.base = p.base;
        if ('tripDays' in p) m.tripDays = parseDays(p.tripDays);
        if ('unit' in p) m.unit = p.unit === 'nights' ? 'nights' : 'days';
        if ('settle' in p) m.settle = p.settle === 'direct' ? 'direct' : 'hub';
        if ('hub' in p) m.hub = p.hub && memberIds.has(p.hub) ? p.hub : null;
        if ('ilsPer' in p) {
          const usd = Number(p.ilsPer?.USD), eur = Number(p.ilsPer?.EUR);
          if (!(usd > 0 && usd < 1000 && eur > 0 && eur < 1000)) fail('שער לא תקין');
          m.ilsPer = { ILS: 1, USD: round4(usd), EUR: round4(eur) };
          m.ratesDate = p.ratesDate ? str(p.ratesDate, 20) : null;
          m.ratesAuto = !!p.ratesAuto;
        }
        await writeVersioned(t, 'meta', m);
        break;
      }
      default:
        fail('פעולה לא מוכרת');
    }
    return res.status(200).json({ ...extra, trip: await loadTrip(t) });
  } catch (e) {
    if (e instanceof UserError) return res.status(400).json({ error: e.message });
    console.error(e);
    return res.status(500).json({ error: 'שגיאת שרת' });
  }
}
