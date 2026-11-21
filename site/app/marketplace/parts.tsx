import type { ReactNode } from "react";

export function Avatar({ name, src, size = 64 }: { name: string; src?: string; size?: number }) {
  if (src) return <img className="mk-avatar" src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" />;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="mk-avatar mk-avatar-text" style={{ width: size, height: size }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Empty({ title, children, action }: { title: string; children: ReactNode; action: { href: string; label: string } }) {
  return (
    <div className="mk-empty panel">
      <h2 className="mk-empty-h">{title}</h2>
      <p>{children}</p>
      <a className="btn btn-primary" href={action.href}>
        {action.label} <span className="arw">→</span>
      </a>
    </div>
  );
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mk-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt className="meta">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Chips({ items }: { items: string[] }) {
  return (
    <ul className="mk-tags">
      {items.map((t) => (
        <li key={t} className="mv-pill">{t}</li>
      ))}
    </ul>
  );
}
