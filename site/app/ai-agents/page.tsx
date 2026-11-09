import { Header, REPO_URL } from "../components/Header";
import { MoveClips } from "../components/MoveClips";
import { Next, PageTop, Toc } from "../components/Xp";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { Footer } from "../components/Footer";
import { SectionView, TableView } from "../components/RichText";
import { AltEvidence } from "../components/AltEvidence";
import { AGENT_COMMANDS, AGENT_FAQ, AGENT_LIMITS, AGENT_PAGE, AGENT_STEPS } from "../../lib/content/ai-agents";
import { pageMetadata } from "../components/seo";
import { AGENTS_DESCRIPTION, AGENTS_TITLE } from "../../lib/agent-guide";
import "../components/intent.css";

export const metadata = pageMetadata({
  title: AGENTS_TITLE,
  description: AGENTS_DESCRIPTION,
  path: "/ai-agents",
});

/* /ai-agents · the intent page for "video rendering for AI agents". Every fact below is read off the
 * repo AGENTS.md, README.md, harness/cli/verbs.mjs and skills/; no adoption numbers, no
 * benchmark, no characterisation of any other product.
 */

const LOOP = `bin/vawe new launch          # page.html + brief.md
bin/vawe dev films/launch/page.html
bin/vawe critique films/launch/page.html
bin/vawe ship films/launch/page.html`;

const INSTALL = `npm install
bin/vawe-dev doctor      # names each missing tool
bin/vawe new hello`;

export default function AiAgents() {
  return (
    <div className="shell">
      <Header />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "vawe", url: "/" }, { name: "AI agents", url: "/ai-agents" }]))} />
      <div className="wrap">
        <main id="content" className="ipage xp" tabIndex={-1}>
          <section className="phead">
            <PageTop group="Learn" current="AI agents" />
            <h1>Let an agent write the video.</h1>
            <p>
              A Vawe film is one HTML page: CSS, Web Animations, SVG, canvas or three.js. An agent
              already writes all of that, so it learns no private format and guesses no schema. If
              something it would naturally write fails, that is a bug in the engine.
            </p>
            <Toc items={[
              { href: "#steps", label: "Step by step" },
              { href: "#loop", label: "The loop" },
              { href: "#commands", label: "Commands" },
              { href: "#judge", label: "The judge" },
              { href: "#skills", label: "Skills" },
              { href: "#wire", label: "Wire it in" },
              { href: "#faq", label: "Questions" },
            ]} />
          </section>

          <SectionView s={AGENT_STEPS} />

          <section className="isec" id="loop">
            <div className="isec-text">
              <h2>One command, one loop.</h2>
              <p>
                <code>bin/vawe</code> runs everything. <code>new</code> starts a film from a
                template, <code>dev</code> renders a half-size draft and checks it,{" "}
                <code>critique</code> lays out the frames to look at, and <code>ship</code> renders
                the final at 60fps with motion blur and audio. A wrong flag exits with the list of
                valid ones, so an agent corrects itself in one step instead of reading source.
              </p>
              <span className="cite">bin/vawe --help · harness/cli/verbs.mjs</span>
            </div>
            <div className="isec-art">
              <div className="codeblock">
                <div className="lbl">the loop</div>
                <pre className="code">{LOOP}</pre>
              </div>
            </div>
          </section>

          <section className="iend" id="commands">
            <h2 className="h2">{AGENT_COMMANDS.title}</h2>
            <p className="lead">{AGENT_COMMANDS.lead}</p>
            <TableView t={AGENT_COMMANDS.data} />
          </section>

          <SectionView s={AGENT_PAGE} />

          <section className="isec" id="judge">
            <div className="isec-text">
              <h2>The writer never grades its own film.</h2>
              <p>
                A critique runs in a session that did not write the page, and{" "}
                <code>bin/vawe critique --fresh</code> starts a fresh session to score the
                draft. A pass is never self-recorded. The agent that wrote the film fixes
                only the seconds the critique named and renders those seconds again, not the whole
                film.
              </p>
              <span className="cite">AGENTS.md · skills/vawe-critique</span>
            </div>
          </section>

          <section className="isec" id="skills">
            <div className="isec-text">
              <h2>Skills teach the parts that are not defaults.</h2>
              <p>
                The repo ships skills an agent loads on demand: <code>vawe-brief</code> turns a
                request into a brief, <code>vawe-page</code> writes the page, <code>vawe-critique</code>{" "}
                looks at a render as a fresh session, and <code>vawe-reference</code> matches a
                reference video. <code>AGENTS.md</code> holds only what an agent would get wrong on
                its own: the page contract, the motion rules that are not its defaults, and the
                first-draft habits it should not ship.
              </p>
              <span className="cite">skills/ · AGENTS.md</span>
            </div>
          </section>

          <section className="isec" id="wire">
            <div className="isec-text">
              <h2>Wire it into an agent.</h2>
              <p>
                Clone the repo, install, and let <code>bin/vawe-dev doctor</code> name any missing tool
                with the install line for your system. Then point the agent at{" "}
                <code>AGENTS.md</code> and ask for a film.
              </p>
              <span className="cite">README.md</span>
            </div>
            <div className="isec-art">
              <div className="codeblock">
                <div className="lbl">install</div>
                <pre className="code">{INSTALL}</pre>
              </div>
            </div>
          </section>

          <SectionView s={AGENT_LIMITS} />

          <AltEvidence faq={AGENT_FAQ} />

          <section className="ifilms">
            <h2>What an agent writes: video components to copy.</h2>
            <p>Each video component is a clip and a markdown file with the snippet. An agent copies one into the page.</p>
            <MoveClips names={["agent-progress", "cursor-click", "text-scramble-decode", "counter-dive"]} />
          </section>

          <Next
            title="Why the draft matches the final."
            lead="The page runs under a virtual clock, so a moment the agent approves in a draft is the same moment in the final."
            primary={{ href: "/determinism", label: "Read the mechanism" }}
            secondary={{ href: REPO_URL, label: "The source, on GitHub" }}
            related={[
              { href: "/video-components", label: "Video components to copy, each with its clip" },
              { href: "/features", label: "What the engine does, with proof" },
              { href: "/blog/make-video-claude-code", label: "Make an MP4 with Claude Code" },
              { href: "/blog/can-claude-make-videos", label: "Can Claude make videos?" },
              { href: "/agentic-video-editing", label: "Let the agent edit your own clips" },
              { href: "/ai-agents.md", label: "This guide as Markdown" },
              { href: "/llms-full.txt", label: "llms-full.txt" },
            ]}
          />
        </main>
      </div>
      <Footer active="/ai-agents" />
    </div>
  );
}
