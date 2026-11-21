// Which media files a template's timeline names, read back from the written FCP 7 XML and After Effects script, so the export (and
// its tests) can check each one is in media/. A name is the path under media/ (a PNG sequence is <name>/<name>_00001.png). Pure.

// The folder the Premiere pathurls name. It is never a real path of this machine (that would put a user name in a public download),
// so Premiere asks for the media once and relinks the rest by name.
export const MEDIA_ROOT = '/vawe-template/media';

const decodePath = (url, root) => {
  const prefix = `file://localhost${root.split('/').map(encodeURIComponent).join('/')}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length).split('/').map(decodeURIComponent).join('/') : decodeURIComponent(url.split('/').at(-1));
};

/** The media file paths (under media/) the XML's pathurls end in. */
export const xmlFiles = (xml, root = MEDIA_ROOT) => [...xml.matchAll(/<pathurl>([^<]+)<\/pathurl>/g)].map(([, url]) => decodePath(url, root));

/** The media file paths in the script's plan literal. */
export const jsxFiles = (jsx) => [...jsx.matchAll(/"file":"((?:[^"\\]|\\.)*)"/g)].map(([, name]) => JSON.parse(`"${name}"`));

/** Every media file either timeline names, once, sorted. */
export const referencedFiles = (xml, jsx) => [...new Set([...xmlFiles(xml), ...jsxFiles(jsx)])].sort();
