import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Next } from "../components/Xp";
import { pageMetadata } from "../components/seo";
import { CATEGORIES, TEMPLATES, TEMPLATES_DESCRIPTION, TEMPLATES_INTRO, templatesTitle, toCard } from "../../lib/templates";
import { jsonLdScript } from "../../lib/schema";
import { templatesItemListSchema } from "../../lib/schema-content";
import { TemplatesGallery } from "./TemplatesGallery";
import "../video-components/moves.css";
import "./templates.css";

export const metadata = pageMetadata({
  title: templatesTitle(),
  description: TEMPLATES_DESCRIPTION,
  path: "/templates",
});

export default function Templates() {
  return (
    <div className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(templatesItemListSchema())} />
      <Header active="templates" />
      <main className="wrap" id="content" tabIndex={-1}>
        <section className="ls ls-top mv">
          <h1>Templates.</h1>
          <p className="mv-intro">
            {TEMPLATES_INTRO} Every template is built from the <Link href="/video-components">video components</Link>.
          </p>
          <p className="mv-intro">
            Templates for After Effects, Premiere Pro, Final Cut Pro, DaVinci Resolve and Motion, made by other motion designers, are in the <Link href="/marketplace">marketplace</Link>.
          </p>
          <p className="mv-links">
            <a href="/templates.json">templates.json</a>
          </p>
          <TemplatesGallery templates={TEMPLATES.map(toCard)} categories={CATEGORIES} />
          <div className="tpl-pro" id="pro">
            <h2 className="mv-sec-h">Pro templates</h2>
            <p>
              A Pro template unlocks with a license key. You get the key when you buy it. Pass it to <code>vawe new</code> with <code>--key</code>, or set <code>VAWE_KEY</code>, and the files are copied into your project.
            </p>
          </div>
          <Next
            title="Start from a finished film."
            lead="Copy a template, change the words, render it."
            primary={{ href: "/docs", label: "Read the docs" }}
            secondary={{ href: "/video-components", label: "See the video components" }}
            related={[
              { href: "/launch-video", label: "A launch video made with vawe" },
              { href: "/explainer-video", label: "An explainer video made with vawe" },
              { href: "/ai-agents", label: "Let an agent remix a template" },
            ]}
          />
        </section>
      </main>
      <Footer active="/templates" />
    </div>
  );
}
