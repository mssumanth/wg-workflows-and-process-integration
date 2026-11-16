// Pulls the Working Group's scope out of charter/charter.md so the site never
// restates it by hand. Returns empty lists if the charter's shape changes.

export function parseCharterScope(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const inScope = [];
  const outOfScope = [];
  let mode = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,4} /.test(line)) {
      mode = /^#### In Scope/i.test(line) ? 'in' : /^#### Out of Scope/i.test(line) ? 'out' : null;
      continue;
    }
    if (mode === 'in') {
      const m = /^\*\*([A-Z])\. (.+?)\*\*$/.exec(line);
      if (m) inScope.push({ id: m[1], title: m[2].trim() });
    } else if (mode === 'out') {
      const m = /^[-*] (.+)$/.exec(line);
      if (m) outOfScope.push(m[1].trim());
    }
  }
  return { inScope, outOfScope };
}
