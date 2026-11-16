import { VaweMark } from "./Header";
import { Icon } from "./Icon";
import { MARK_LABEL, type Mark, type Rival } from "../../lib/content/vs";

function Cell({ text, mark, vawe }: { text: string; mark?: Mark; vawe?: boolean }) {
  return (
    <td className={vawe ? "is-vawe" : undefined}>
      {mark && (
        <span className={`mk mk-${mark}`}>
          <Icon name={mark === "yes" ? "check" : mark === "no" ? "x" : "minus"} size={14} label={MARK_LABEL[mark]} />
        </span>
      )}
      {text}
    </td>
  );
}

export function RivalTable({ r }: { r: Rival }) {
  return (
    <div className="itable-wrap">
      <table className="itable">
        <thead>
          <tr>
            <th scope="col">feature</th>
            <th scope="col">{r.name}</th>
            <th scope="col" className="is-vawe">
              <VaweMark className="glyph-sm" />
              vawe
            </th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((row) => (
            <tr key={row.feature}>
              <td>{row.feature}</td>
              <Cell text={row.them} mark={row.t} />
              <Cell text={row.vawe} mark={row.v} vawe />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChooseLists({ r }: { r: Rival }) {
  return (
    <section className="tldr" aria-label={`${r.name} or vawe`}>
      <div>
        <h2>Choose {r.name} when</h2>
        <ul>
          {r.chooseThem.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Choose vawe when</h2>
        <ul>
          {r.choosevawe.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HeadToHead({ r }: { r: Rival }) {
  return (
    <>
      <section className="tfacts" id={`vs-${r.slug}`} aria-labelledby={`vs-${r.slug}-title`}>
        <h2 id={`vs-${r.slug}-title`}>vawe vs {r.name}.</h2>
        <p>{r.intro}</p>
        <p>{r.what}</p>
      </section>
      <section className="iend" aria-label={`vawe and ${r.name} side by side`}>
        <RivalTable r={r} />
      </section>
      <ChooseLists r={r} />
      <section className="tfacts">
        <h2>Where {r.name} is stronger.</h2>
        <ul className="tldr-list">
          {r.stronger.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="bnote">
          Read from {r.name}’s own pages on {r.read}:{" "}
          {r.sources.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ", "}
              <a href={s.url} rel="noopener">{s.label}</a>
            </span>
          ))}
          .
        </p>
      </section>
      <section className="faq" aria-label={`Questions about ${r.name}`}>
        <h2>{r.name} questions.</h2>
        <dl>
          {r.faq.map((f) => (
            <div key={f.q}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
