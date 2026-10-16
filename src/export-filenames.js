export function uniqueFilename(title, used) {
  const clean = String(title).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const base = `calendario-${clean || 'partite'}`.slice(0, 110).replace(/-+$/g, '');
  let name = base, number = 1;
  while (used.has(name)) name = `${base}-${++number}`;
  used.add(name);
  return name;
}

export function calendarDownloadName(sections) {
  return sections.length === 1 ? uniqueFilename(sections[0].fileTitle || sections[0].title, new Set()) : `fipavonline-calendari-${new Date().toISOString().slice(0, 10)}`;
}
