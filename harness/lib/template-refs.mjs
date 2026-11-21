// Which media files a template's timeline names, read back from the written FCP 7 XML and After Effects script, so the export (and
// its tests) can check each one is in media/. Pure.

/** The media file names the XML's pathurls end in. */
export const xmlFiles = (xml) => [...xml.matchAll(/<pathurl>([^<]+)<\/pathurl>/g)].map(([, url]) => decodeURIComponent(url.split('/').at(-1)));

/** The media file names in the script's plan literal. */
export const jsxFiles = (jsx) => [...jsx.matchAll(/"file":"((?:[^"\\]|\\.)*)"/g)].map(([, name]) => JSON.parse(`"${name}"`));

/** Every media file either timeline names, once, sorted. */
export const referencedFiles = (xml, jsx) => [...new Set([...xmlFiles(xml), ...jsxFiles(jsx)])].sort();
