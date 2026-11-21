"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Category, TemplateCard } from "../../lib/templates";
import { templateFiles } from "../../lib/template-urls";
import { MiscSvg } from "../video-components/icons";

const readCategory = (known: string[]) => {
  const v = new URLSearchParams(window.location.search).get("category");
  return v && known.includes(v) ? v : "";
};

function Card({ t, first }: { t: TemplateCard; first: boolean }) {
  const files = templateFiles(t);
  const [live, setLive] = useState(false);
  return (
    <li className="mv-card panel" data-name={t.id} onMouseEnter={() => setLive(true)} onMouseLeave={() => setLive(false)} onFocus={() => setLive(true)} onBlur={() => setLive(false)}>
      <div className="mv-media">
        <img src={files.poster} alt={`${t.title}: a frame from the template`} width={640} height={360} loading={first ? "eager" : "lazy"} decoding="async" />
        {live ? (
          <video src={files.mp4} muted loop playsInline autoPlay aria-hidden="true" onPlaying={(e) => e.currentTarget.setAttribute("data-on", "")} />
        ) : null}
        <span className="mv-chip mv-chip-num tpl-tier" data-tier={t.tier}>{t.tier === "pro" ? "Pro" : "Free"}</span>
        <span className="mv-chip mv-chip-dur" aria-hidden="true">
          <MiscSvg name="play" size={9} />
          {t.length} s
        </span>
        <p className="mv-use">{t.summary}</p>
      </div>
      <div className="mv-cap">
        <h3 className="mv-title">
          <Link href={`/templates/${t.id}`} prefetch={false}>{t.title}</Link>
        </h3>
        <p className="mv-use-touch">{t.summary}</p>
      </div>
    </li>
  );
}

export function TemplatesGallery({ templates, categories }: { templates: TemplateCard[]; categories: Category[] }) {
  const [category, setCategory] = useState("");
  useEffect(() => setCategory(readCategory(categories.map((c) => c.id))), [categories]);

  const pick = (id: string) => {
    setCategory(id);
    window.history.replaceState(null, "", id ? `?category=${id}` : window.location.pathname);
  };
  const used = categories.filter((c) => templates.some((t) => t.category === c.id));
  const shown = category ? templates.filter((t) => t.category === category) : templates;

  if (!templates.length) {
    return (
      <div className="mv-empty">
        <p>No templates yet. The first ones are coming.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mv-bar" role="group" aria-label="Filter by category">
        <nav className="mv-jump tpl-chips">
          <button type="button" aria-pressed={category === ""} onClick={() => pick("")}>
            All<span className="mv-n">{templates.length}</span>
          </button>
          {used.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => pick(c.id)}>
              {c.label}
              <span className="mv-n">{templates.filter((t) => t.category === c.id).length}</span>
            </button>
          ))}
        </nav>
        <p className="meta mv-count" role="status">
          {shown.length}
          <span className="sr-only"> {shown.length === 1 ? "template" : "templates"}</span>
        </p>
      </div>
      <ul className="mv-grid tpl-grid">
        {shown.map((t, i) => (
          <Card key={t.id} t={t} first={i < 3} />
        ))}
      </ul>
    </>
  );
}
