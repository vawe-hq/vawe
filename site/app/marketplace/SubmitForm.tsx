"use client";

import { useState, type FormEvent } from "react";

export type Field = {
  name: string;
  label: string;
  type: "text" | "url" | "number" | "date" | "textarea" | "select" | "checkboxes";
  required?: boolean;
  max?: number;
  min?: number;
  step?: string;
  hint?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};
export type Group = { title: string; fields: Field[] };

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; pr: string } | { kind: "error"; message: string; errors: string[] };

function formValues(form: HTMLFormElement, groups: Group[]) {
  const data = new FormData(form);
  const out: Record<string, string | string[]> = {};
  for (const f of groups.flatMap((g) => g.fields)) out[f.name] = f.type === "checkboxes" ? data.getAll(f.name).map(String) : String(data.get(f.name) ?? "");
  out.fax = String(data.get("fax") ?? "");
  return out;
}

function Control({ f }: { f: Field }) {
  const id = `f-${f.name}`;
  const hint = f.hint ? `${id}-hint` : undefined;
  const common = { id, name: f.name, required: f.required, "aria-describedby": hint };
  if (f.type === "checkboxes") {
    return (
      <fieldset className="mk-field mk-field-wide">
        <legend>{f.label}{f.required ? <span className="mk-req"> (required)</span> : null}</legend>
        {f.hint ? <p className="mk-hint" id={hint}>{f.hint}</p> : null}
        <ul className="mk-checks">
          {f.options?.map((o) => (
            <li key={o.value}>
              <label>
                <input type="checkbox" name={f.name} value={o.value} />
                {o.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    );
  }
  const input =
    f.type === "textarea" ? (
      <textarea {...common} maxLength={f.max} rows={f.max && f.max > 1000 ? 10 : 4} />
    ) : f.type === "select" ? (
      <select {...common} defaultValue="">
        <option value="" disabled={f.required}>{f.required ? "Choose one" : "None"}</option>
        {f.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ) : (
      <input {...common} type={f.type} maxLength={f.type === "number" ? undefined : f.max} min={f.min} max={f.type === "number" ? f.max : undefined} step={f.step} placeholder={f.placeholder} inputMode={f.type === "number" ? "decimal" : undefined} />
    );
  return (
    <div className={f.type === "textarea" ? "mk-field mk-field-wide" : "mk-field"}>
      <label htmlFor={id}>{f.label}{f.required ? <span className="mk-req"> (required)</span> : null}</label>
      {input}
      {f.hint ? <p className="mk-hint" id={hint}>{f.hint}</p> : null}
    </div>
  );
}

export function SubmitForm({ kind, groups, submitLabel, doneText }: { kind: string; groups: Group[]; submitLabel: string; doneText: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "sending" });
    const res = await fetch("/api/marketplace/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, ...formValues(e.currentTarget, groups) }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { pr?: string; error?: string; errors?: string[] } | null;
    if (res && res.ok && body?.pr) setState({ kind: "done", pr: body.pr });
    else if (res && res.ok) setState({ kind: "done", pr: "" });
    else setState({ kind: "error", message: body?.error ?? "The form could not be sent. Try again in a minute.", errors: body?.errors ?? [] });
  }

  if (state.kind === "done") {
    return (
      <div className="mk-done panel" role="status">
        <h2 className="mk-empty-h">Thanks. It is in review.</h2>
        <p>{doneText}</p>
        {state.pr ? <p><a href={state.pr}>See the pull request on GitHub</a></p> : null}
      </div>
    );
  }

  return (
    <form className="mk-form" onSubmit={send}>
      {groups.map((g) => (
        <fieldset className="mk-group panel" key={g.title}>
          <legend className="mk-group-h">{g.title}</legend>
          <div className="mk-fields">
            {g.fields.map((f) => (
              <Control key={f.name} f={f} />
            ))}
          </div>
        </fieldset>
      ))}
      <div className="mk-trap" aria-hidden="true">
        <label htmlFor="f-fax">Leave this empty</label>
        <input id="f-fax" name="fax" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state.kind === "error" ? (
        <div className="mk-error" role="alert">
          <p>{state.message}</p>
          {state.errors.length ? (
            <ul>
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mk-send">
        <button className="btn btn-primary" type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : submitLabel}
        </button>
        <p className="mk-hint">The owner reads every entry before it goes live. You see it as a pull request on GitHub.</p>
      </div>
    </form>
  );
}
