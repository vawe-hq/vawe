export function Code({ label, text }: { label: string; text: string }) {
  return (
    <figure className="mv-code">
      <div className="mv-code-bar">
        <span>{label}</span>
        <button type="button" className="mv-copy" data-copy>Copy</button>
      </div>
      <pre><code>{text}</code></pre>
    </figure>
  );
}
