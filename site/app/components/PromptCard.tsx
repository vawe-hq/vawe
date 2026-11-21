import { CopyBtn } from "../easing/CopyBtn";

export function PromptCard({ prompt }: { prompt?: string }) {
  if (!prompt) return null;
  return (
    <section className="pcard" aria-labelledby="prompt-title">
      <div className="pcard-head">
        <h2 id="prompt-title">Copy this prompt into your agent</h2>
        <CopyBtn className="btn btn-primary pcard-copy" value={prompt} label="Copy prompt" action="copy-prompt" />
      </div>
      <p className="pcard-lead">Paste it into Claude Code, Codex or Cursor. Fill in the parts in angle brackets. The agent installs vawe if it needs to and does the steps on this page.</p>
      <pre className="pcard-text">{prompt}</pre>
    </section>
  );
}
