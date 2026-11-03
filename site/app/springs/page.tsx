import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { pageMetadata } from "../components/seo";
import { jsonLdScript, breadcrumbSchema } from "../../lib/schema";
import { LIBRARIES, SPRINGS, SPRINGS_DESCRIPTION, SPRINGS_TITLE, THRESHOLD_PERCENT, itemListSchema, springsIn, characterOf, curveOf, type Spring } from "../../lib/springs";
import { Thumb } from "../easing/Charts";
import { CopyBtn } from "../easing/CopyBtn";
import { Next } from "../components/Xp";
import "../easing/easing.css";

export const metadata = pageMetadata({ title: SPRINGS_TITLE, description: SPRINGS_DESCRIPTION, path: "/springs" });

function Card({ s }: { s: Spring }) {
  return (
    <li className="panel ez-card">
      <div className="ez-thumbwrap">
        <Thumb e={curveOf(s)} />
      </div>
      <Link href={`/springs/${s.slug}`} prefetch={false}>{s.name}</Link>
      <p className="ez-blurb">Stiffness {s.k}, damping {s.d}.</p>
      <span className="meta">settles {s.settle} s / overshoot {s.overshoot}%</span>
      <div className="ez-card-act">
        <CopyBtn className="" value={s.linear} label="Copy linear()" />
      </div>
    </li>
  );
}

const byOvershoot = [...SPRINGS].sort((a, b) => a.overshoot - b.overshoot || a.settle - b.settle);

export default function SpringsIndex() {
  return (
    <div className="shell">
      <Header active="resources" />
      <main className="wrap" id="content" tabIndex={-1}>
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(itemListSchema())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Springs", url: "/springs" }]))} />
        <div className="ez">
          <header className="phead ez-head">
            <h1>Spring animation presets as CSS</h1>
            <p className="ez-sum">
              {SPRINGS.length} springs from react-spring, Motion, SwiftUI, Jetpack Compose, Material 3 and vawe. Each page has the stiffness and damping read from the library&rsquo;s own source, the settle time, the overshoot, a live demo and a <code>linear()</code> string to copy.
            </p>
          </header>

          <nav className="ez-jump" aria-label="On this page">
            <a href="#how">Stiffness, damping and mass</a>
            <a href="#all">All presets</a>
            <a href="#table">Compare the numbers</a>
          </nav>

          <section className="ez-sec" id="how" aria-labelledby="h-how">
            <h2 id="h-how">Stiffness, damping and mass</h2>
            <p>
              A spring pulls a value toward its target. <strong>Stiffness</strong> is how hard it pulls: a higher number is a faster move. <strong>Damping</strong> is the friction that drains speed: a low number lets the value swing past the target and back, a high number stops the swing. <strong>Mass</strong> is how heavy the value is. Every preset here has mass 1; if a library sets another mass, divide its stiffness and damping by it.
            </p>
            <p>
              The damping ratio, <code>d / (2 x sqrt(k))</code>, says which kind of spring it is. Under 1 it overshoots. At 1 it is critically damped, the fastest settle with no overshoot. Over 1 it creeps in. The settle time on each page is the last moment the spring is more than {THRESHOLD_PERCENT}% away from the end value.
            </p>
            <p>
              A CSS transition cannot take stiffness and damping. The pages turn each spring into a <code>linear()</code> easing and a duration. In a vawe page, <code>spring(t, k, d)</code> in <code>core/motion/springs.js</code> returns the same curve for any time.
            </p>
          </section>

          <h2 id="all" className="ez-all">All presets</h2>
          {LIBRARIES.map((lib) => (
            <section className="ez-group" id={lib.id} key={lib.id} aria-labelledby={`g-${lib.id}`}>
              <h2 id={`g-${lib.id}`}>{lib.label}</h2>
              <p>{lib.intro}</p>
              <ul className="ez-grid-cards">{springsIn(lib.id).map((s) => <Card key={s.slug} s={s} />)}</ul>
            </section>
          ))}

          <section className="ez-sec" id="table" aria-labelledby="h-table">
            <h2 id="h-table">Compare the numbers</h2>
            <p>Every preset from the least to the most overshoot.</p>
            <div className="ez-scroll">
              <table className="ez-table ez-stack">
                <thead>
                  <tr><th>Preset</th><th>Stiffness</th><th>Damping</th><th>Ratio</th><th>Settle</th><th>Overshoot</th></tr>
                </thead>
                <tbody>
                  {byOvershoot.map((s) => (
                    <tr key={s.slug}>
                      <td data-label="Preset"><Link href={`/springs/${s.slug}`} prefetch={false}>{s.name}</Link></td>
                      <td data-label="Stiffness" className="n">{s.k}</td>
                      <td data-label="Damping" className="n">{s.d}</td>
                      <td data-label="Ratio" className="n" title={characterOf(s)}>{s.zeta}</td>
                      <td data-label="Settle" className="n">{s.settle} s</td>
                      <td data-label="Overshoot" className="n">{s.overshoot}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ez-note">
              react-spring default and vawe default are the same spring. SwiftUI and Compose values are converted to stiffness and damping with the formula on each page. For an easing with no spring, see <Link href="/easing">the easing functions</Link>.
            </p>
          </section>

          <Next
            title="Use a spring in a film"
            primary={{ href: "/video-components", label: "See the video components" }}
            secondary={{ href: "/easing", label: "Easing functions" }}
            related={[{ href: "/docs/motion", label: "Motion in the docs" }]}
          />
        </div>
      </main>
      <Footer active="/springs" />
    </div>
  );
}
