// One line per free font face and per synth voice, so an agent never lists a directory.
const titleCase = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ').replace('Jetbrains', 'JetBrains').replace('Ibm', 'IBM');

/** Free faces as [file, family, weight] from fonts.lock.json `faces`; OG-only .woff instances are left out. */
export function freeFaces(faces) {
  return Object.entries(faces)
    .filter(([file]) => file.endsWith('.woff2'))
    .map(([file, f]) => {
      const family = titleCase(f.pkg.split('/')[1]);
      const static_ = /-(\d00)-/.exec(f.file);
      const italic = f.file.includes('italic') ? ' italic' : '';
      return [file, family, static_ ? `${static_[1]}${italic}` : 'variable 100-900'];
    })
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
}

export function fontLines(faces) {
  return [
    'free faces (OFL). Copy the file into films/<name>/assets/, then src: url("assets/<file>") format("woff2"):',
    ...freeFaces(faces).map(([file, family, weight]) => `${family} | ${weight} | assets/fonts/${file}`),
    'if a listed file is not in assets/fonts, fetch it: node generators/media/fonts.mjs',
  ];
}

/** The free faces as one line for a brief: "Family: file, file; ...", the files being the ones in assets/fonts/. */
export function fontsLine(faces) {
  const byFamily = new Map();
  for (const [file, family] of freeFaces(faces)) byFamily.set(family, [...(byFamily.get(family) ?? []), file]);
  return [...byFamily].map(([family, files]) => `${family}: ${files.join(', ')}`).join('; ');
}

export function soundLines(cues, gains, lengthOf) {
  return [
    'synth voices for <audio data-synth="NAME" data-at="s">; gain is the default dB, length is the tail in s:',
    ...Object.keys(cues).map((name) => `${name} | ${gains[name]} dB | ${lengthOf(cues[name]).toFixed(2)} s`),
  ];
}

/** [{ family, styles }] from lines of `family|style` (fc-list --format), system UI families (a leading dot) left out, sorted by family. */
export function parseSystemFonts(text) {
  const byFamily = new Map();
  for (const line of String(text).split('\n')) {
    const [family, style] = line.split('|').map((x) => x?.trim());
    if (!family || family.startsWith('.') || !/^[\x20-\x7e]+$/.test(family)) continue;
    byFamily.set(family, [...new Set([...(byFamily.get(family) ?? []), style].filter(Boolean))]);
  }
  return [...byFamily].map(([family, styles]) => ({ family, styles })).sort((a, b) => a.family.localeCompare(b.family));
}

/** The lines of the retired `vawe fonts --system`: each installed family usable through local(), and the rule for using it. */
export function systemFontLines(fonts) {
  return [
    'system faces on this machine. Use one in a film that you render yourself: @font-face { font-family: "Mine"; src: local("<name>"); }',
    'Never copy or commit the font file: it is licensed to this machine, and the film renders only where the face is installed.',
    ...fonts.map((f) => `${f.family} | ${f.styles.join(', ')} | local("${f.family}")`),
  ];
}
