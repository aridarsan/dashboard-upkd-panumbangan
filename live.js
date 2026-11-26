/* Sumber data realtime: Google Sheets yang dipublikasikan sebagai CSV.
 * Ganti SHEET_CSV_URL bila link berubah. Kosongkan ('') untuk memakai data.js saja. */
window.UPKD_LIVE = (() => {
  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSC84-4_n7HYH6383pwHnNko6VKkDoe1TtLUZNfwfU25RcH0XpTl4uQkHkcCvJ8XyPk56PSQRCuCVV6/pub?gid=0&single=true&output=csv';
  // Sheet POSYANDU (kosongkan '' bila tidak dipakai)
  const POSYANDU_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSC84-4_n7HYH6383pwHnNko6VKkDoe1TtLUZNfwfU25RcH0XpTl4uQkHkcCvJ8XyPk56PSQRCuCVV6/pub?gid=112994670&single=true&output=csv';
  const REFRESH_MINUTES = 5;

  // Kolom (0-based) per kategori — sama dengan scripts/convert_excel.py
  const GROUPS = [
    ['penduduk', 'Jumlah Penduduk', 2, 4],
    ['spm', 'Capaian Pelayanan Kesehatan (SPM)', 5, 16],
    ['pmt', 'Pemberian PMT', 17, 20],
    ['upkd', 'Pelayanan di UPKD & Puskesmas', 21, 38],
  ];
  const PERCENT_HINT = ['PERSENTASE', 'ANGKA BEBAS JENTIK'];
  const clean = s => (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
  const titleCase = s => s.toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

  // CSV parser (mendukung tanda kutip & koma di dalam sel)
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // Angka format Indonesia: "3.003" = 3003, "54,1" = 54.1
  function num(s) {
    s = clean(s).replace(/%$/, '');
    if (s === '' || s === '-' || s === '–') return null;
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function build(rows) {
    const header = rows[1] || [];
    const indicators = [];
    for (const [key, , start, end] of GROUPS) {
      for (let c = start; c <= end; c++) {
        let name = clean(header[c]);
        if (!name) continue;
        if (key === 'penduduk' && name.toLowerCase() === 'total') name = 'Total Penduduk';
        indicators.push({id: `${key}_${c}`, col: c, category: key, name,
          percent: PERCENT_HINT.some(h => name.toUpperCase().includes(h))});
      }
    }
    const villages = []; let compare = {};
    for (const r of rows.slice(2)) {
      const first = clean(r[0]).toUpperCase();
      if (/^\d+$/.test(first) && clean(r[1])) {
        villages.push({no: +first, name: titleCase(clean(r[1])),
          values: Object.fromEntries(indicators.map(i => [i.id, num(r[i.col])]))});
      } else if (first === 'TARGET') {
        // baris target: nilai pembagi untuk % capaian & kontribusi desa
        indicators.forEach(i => { const v = num(r[i.col]); if (v) i.target = v; });
      } else if (first.startsWith('DATA SPM')) {
        const values = {};
        indicators.filter(i => i.category === 'spm').forEach(i => { const v = num(r[i.col]); if (v != null) values[i.id] = v; });
        compare = {label: titleCase(clean(r[0])), values};
      }
    }
    if (!villages.length || !indicators.length) throw new Error('Format spreadsheet tidak dikenali');
    indicators.forEach(i => delete i.col);
    const now = new Date();
    return {
      title: 'Data Pelayanan UPKD', subtitle: 'PKM Panumbangan', period: 's.d. November 2026',
      source: 'Google Sheets (live)',
      generated: now.toLocaleString('id-ID', {dateStyle: 'medium', timeStyle: 'short'}),
      categories: GROUPS.map(([id, label]) => ({id, label})),
      indicators, villages, compare,
    };
  }

  // Sheet POSYANDU: No, Nama Posyandu, Desa, Dusun, Siklus, JANUARI..DESEMBER, RATA-RATA (nilai %)
  function buildPosyandu(rows) {
    const h = (rows[0] || []).map(x => clean(x).toUpperCase());
    const m0 = h.indexOf('JANUARI');
    if (m0 < 0) throw new Error('Format sheet Posyandu tidak dikenali');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const col = n => h.indexOf(n);
    const iName = col('NAMA POSYANDU'), iDesa = col('DESA'), iDusun = col('DUSUN'), iSik = col('SIKLUS');
    if (iName < 0 || iSik < 0) throw new Error('Kolom Nama Posyandu / Siklus tidak ditemukan');
    const out = [];
    for (const r of rows.slice(1)) {
      if (!/^\d+$/.test(clean(r[0])) || !clean(r[iName])) continue;
      const name = titleCase(clean(r[iName])).replace(/\b(I{1,3}|Iv|Vi{0,3}|Ix|X)$/i, m => m.toUpperCase());
      out.push({no: +clean(r[0]), name, group: name.replace(/\s+[IVX]+$/, ''),
        desa: iDesa >= 0 ? titleCase(clean(r[iDesa])) : '', dusun: iDusun >= 0 ? titleCase(clean(r[iDusun])) : '',
        siklus: clean(r[iSik]).toUpperCase(), values: MONTHS.map((_, k) => num(r[m0 + k]))});
    }
    if (!out.length) throw new Error('Sheet Posyandu kosong');
    return {months: MONTHS, rows: out};
  }

  async function fetchCSV(url) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}_=${Date.now()}`, {cache: 'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCSV(await res.text());
  }

  async function load() {
    if (!SHEET_CSV_URL) throw new Error('Link spreadsheet belum diatur');
    const [main, pos] = await Promise.all([
      fetchCSV(SHEET_CSV_URL),
      POSYANDU_CSV_URL ? fetchCSV(POSYANDU_CSV_URL).catch(() => null) : null,
    ]);
    const data = build(main);
    if (pos) { try { data.posyandu = buildPosyandu(pos); } catch (e) { /* pakai data cadangan */ } }
    return data;
  }

  return {load, enabled: !!SHEET_CSV_URL, refreshMs: REFRESH_MINUTES * 60 * 1000};
})();
