import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PageTop } from "../components/Xp";
import { formGroups } from "../../lib/marketplace-forms";
import { SUBMIT_PAGES } from "../../lib/marketplace-pages";
import { REPO_URL } from "../../lib/site";
import { SubmitForm } from "./SubmitForm";
import "./marketplace.css";

const SUBMIT_LABEL = { listing: "Send the listing", job: "Send the job", designer: "Send my profile" } as const;

export function SubmitPage({ kind, parent, current }: { kind: keyof typeof SUBMIT_PAGES; parent: { href: string; label: string }; current: string }) {
  const p = SUBMIT_PAGES[kind];
  return (
    <div className="shell">
      <Header />
      <main className="wrap" id="content" tabIndex={-1}>
        <div className="ipage mk-page">
          <header className="phead">
            <PageTop parent={parent} current={current} />
            <h1>{p.h1}</h1>
            {p.intro.map((t) => (
              <p className="mk-lead" key={t}>{t}</p>
            ))}
            <p className="mk-lead">
              You can also open the pull request yourself: add a JSON file to <a href={`${REPO_URL}/tree/main/${p.folder}`}>{p.folder}</a>.
            </p>
          </header>
          <SubmitForm kind={kind} groups={formGroups(kind)} submitLabel={SUBMIT_LABEL[kind]} doneText={p.done} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
