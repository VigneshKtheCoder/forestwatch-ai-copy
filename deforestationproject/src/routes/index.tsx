import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { SatelliteViewer } from "@/components/satellite-viewer";
import {
  ArrowRight, Satellite, LineChart, ShieldCheck, FileDown,
  Globe2, Trees, TrendingDown, Eye, Clock, MapPin,
  BarChart2, ChevronRight, Zap, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Retreeval · Satellite deforestation monitoring for conservation" },
      { name: "description", content: "Detect, measure and report forest loss anywhere on Earth using Sentinel-2 imagery, NDVI change detection and ML — built for nonprofits, researchers and agencies." },
      { property: "og:title", content: "Retreeval" },
      { property: "og:description", content: "Open satellite intelligence for the organizations protecting the world's forests." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="hero-grad relative overflow-hidden text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28 lg:gap-16">

          {/* Left: headline + CTA */}
          <div className="flex flex-col justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-sage w-fit">
              <Satellite className="h-3.5 w-3.5" />
              Sentinel-2 L2A · ESA Copernicus · NDVI Change Detection
            </div>

            <h1 className="mt-6 font-display text-5xl leading-[1.04] tracking-tight md:text-6xl">
              The forest is changing.<br />
              <span className="text-sage">See it from orbit.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/75">
              Retreeval turns free European Space Agency imagery into hectare-accurate
              deforestation evidence — for nonprofits, researchers and government agencies
              defending the world's last intact ecosystems.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/analyze"
                className="inline-flex items-center gap-2 rounded-md bg-sage px-5 py-3 text-sm font-medium text-forest-deep transition hover:bg-white"
              >
                Run a free analysis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                View live dashboard
              </Link>
            </div>

            {/* Stats row */}
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 text-left">
              {[
                ["691,500", "ha monitored"],
                ["10", "active regions"],
                ["72,350 ha", "loss detected"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-3xl text-white">{n}</dt>
                  <dd className="mt-0.5 text-xs uppercase tracking-wider text-white/55">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: real satellite comparison viewer */}
          <div className="flex flex-col justify-center">
            <SatelliteViewer />
            <div className="mt-2.5 flex items-center justify-end gap-1.5 text-[10px] text-white/35">
              <Satellite className="h-3 w-3" />
              Sentinel-2 L2A · ESRI World Imagery · NDVI (B8−B4)/(B8+B4)
            </div>
          </div>
        </div>
      </section>

      {/* ── The Problem ──────────────────────────────────────────── */}
      <section className="border-b border-border bg-[#0d1f14] text-white">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-sage/80">The Global Crisis</p>
            <h2 className="mt-3 font-display text-4xl leading-snug">
              15 billion trees are lost every year.<br />
              <span className="text-sage">Most of it goes undetected.</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65">
              Governments, nonprofits and researchers desperately need real-time intelligence
              on where forests are disappearing — but traditional monitoring methods are
              too slow, too expensive, and too imprecise to stop illegal clearing in time.
            </p>
          </div>

          {/* Problem stat cards */}
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: TrendingDown,
                stat: "4.7M ha",
                label: "lost every month",
                sub: "Global net tropical forest loss since 2000 — equivalent to losing a football pitch every 2 seconds.",
                color: "text-red-400",
              },
              {
                icon: Eye,
                stat: "< 10%",
                label: "detected in real time",
                sub: "Less than one-tenth of illegal deforestation events are caught as they happen with current monitoring tools.",
                color: "text-amber-400",
              },
              {
                icon: Clock,
                stat: "6–18 months",
                label: "average detection lag",
                sub: "Traditional aerial survey and manual analysis cycles mean action comes far too late to stop clearance.",
                color: "text-amber-400",
              },
              {
                icon: ShieldCheck,
                stat: "Only 17%",
                label: "of tropical forests protected",
                sub: "Even officially protected areas lose tree cover at alarming rates due to weak enforcement capacity.",
                color: "text-sage",
              },
            ].map(({ icon: Icon, stat, label, sub, color }) => (
              <div
                key={stat}
                className="rounded-xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/8"
              >
                <Icon className={`h-5 w-5 ${color}`} />
                <div className={`mt-4 font-display text-4xl font-bold ${color}`}>{stat}</div>
                <div className="mt-1 text-sm font-medium text-white/80">{label}</div>
                <p className="mt-3 text-xs leading-relaxed text-white/45">{sub}</p>
              </div>
            ))}
          </div>

          {/* Call-out bar */}
          <div className="mt-10 flex flex-wrap items-center gap-4 rounded-xl border border-sage/20 bg-sage/8 px-6 py-5">
            <Zap className="h-5 w-5 shrink-0 text-sage" />
            <p className="text-sm text-white/75">
              <strong className="text-white">The window to act is shrinking.</strong>{" "}
              Once a forest fragment falls below the critical connectivity threshold,
              the cascade of biodiversity loss becomes irreversible within a decade.
              Early detection — within days, not months — is the only lever organizations have.
            </p>
            <Link
              to="/analyze"
              className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md bg-sage px-4 py-2 text-sm font-medium text-forest-deep transition hover:bg-white"
            >
              Start monitoring <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How Retreeval Works ─────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-moss">Workflow</p>
          <h2 className="mt-3 text-4xl">How Retreeval Works</h2>
          <p className="mt-4 text-muted-foreground">
            From satellite archive to publication-ready deforestation report — in minutes,
            not months. No GIS expertise required.
          </p>
        </div>

        {/* 4-step workflow */}
        <div className="mt-14 relative">
          {/* Connector line (desktop) */}
          <div className="absolute left-[calc(12.5%+1.5rem)] right-[calc(12.5%+1.5rem)] top-7 hidden h-px bg-gradient-to-r from-forest-deep/30 via-moss/60 to-forest-deep/30 lg:block" />

          <div className="grid gap-8 lg:grid-cols-4">
            {[
              {
                n: "01",
                icon: MapPin,
                title: "Select your region",
                body: "Draw any polygon on the global map, upload a GeoJSON boundary, or pick from monitored hotspots. No size limit.",
                link: "/analyze",
                linkLabel: "Open map",
              },
              {
                n: "02",
                icon: Satellite,
                title: "Fetch Sentinel-2 imagery",
                body: "We query ESA's Copernicus archive for cloud-filtered L2A scenes matching your date windows — typically within seconds.",
                link: null,
                linkLabel: null,
              },
              {
                n: "03",
                icon: BarChart2,
                title: "Detect vegetation change",
                body: "NDVI is computed per pixel for both epochs. Significant declines are masked, measured and converted to hectares lost.",
                link: "/methodology",
                linkLabel: "Read the science",
              },
              {
                n: "04",
                icon: FileDown,
                title: "Generate reports & alerts",
                body: "Export CSV time-series, PNG heatmaps and PDF reports. Set ΔNDVI thresholds to trigger real-time alerts.",
                link: "/dashboard",
                linkLabel: "View dashboard",
              },
            ].map(({ n, icon: Icon, title, body, link, linkLabel }) => (
              <div key={n} className="relative flex flex-col">
                {/* Step number badge */}
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-forest-deep bg-background shadow-md">
                  <Icon className="h-6 w-6 text-forest-deep" />
                </div>
                <div className="absolute left-6 top-6 h-3 w-3 rounded-full bg-forest-deep/30 blur-sm" />

                <div className="mt-5">
                  <span className="text-[11px] font-mono font-bold tracking-[0.15em] text-moss">STEP {n}</span>
                  <h3 className="mt-1.5 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  {link && linkLabel && (
                    <Link
                      to={link}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest-deep hover:text-moss"
                    >
                      {linkLabel} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mini analysis preview strip */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-6 py-3 text-xs text-muted-foreground flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-moss animate-pulse" />
            Live analysis result — Rondônia Corridor · 5-year comparison
          </div>
          <div className="grid gap-0 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            {[
              { label: "AOI area", value: "142,500 ha", sub: "custom polygon" },
              { label: "Forest loss detected", value: "18,420 ha", sub: "12.9% of monitored area", highlight: true },
              { label: "NDVI change", value: "−0.27", sub: "confidence: 92%" },
            ].map(({ label, value, sub, highlight }) => (
              <div key={label} className={`px-6 py-5 ${highlight ? "bg-alert/5" : ""}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${highlight ? "text-alert" : "text-foreground"}`}>{value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform Capabilities ─────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Platform</p>
            <h2 className="mt-3 text-4xl">A complete deforestation intelligence pipeline.</h2>
            <p className="mt-4 text-muted-foreground">
              From scene selection to publication-ready reports — every step uses peer-reviewed
              remote-sensing methods and 100% open data. No proprietary lock-in, ever.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: Globe2, title: "Global coverage", body: "Draw an AOI anywhere on Earth. We fetch cloud-filtered Sentinel-2 scenes for any date range going back to 2016." },
              { icon: LineChart, title: "NDVI change detection", body: "NDVI = (NIR − RED)/(NIR + RED), per pixel, between two epochs. Significant declines convert to hectares lost." },
              { icon: Trees, title: "Land-cover classification", body: "Classify patches into Forested, Deforested, Water, Agriculture, Urban and Other using spectral indices." },
              { icon: ShieldCheck, title: "Custom alert thresholds", body: "Set ΔNDVI and area thresholds per region. Get notified the moment a scan crosses your configured trigger." },
              { icon: FileDown, title: "Publication-ready exports", body: "Download PDF reports, PNG heatmaps and CSV time-series for grants, advocacy and government submissions." },
              { icon: Satellite, title: "Open data, always free", body: "Built on Copernicus, AWS Earth Search and Global Forest Watch — free for nonprofits, researchers and agencies." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="ring-soft rounded-xl border border-border bg-card p-6 hover:border-moss/40 transition-colors">
                <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-forest-deep">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Methodology strip ─────────────────────────────────────── */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Methodology</p>
            <h2 className="mt-3 text-3xl">Scientifically defensible by default.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every metric Retreeval produces is reproducible from raw Sentinel-2 L2A imagery
              using the same equations cited by the USGS and ESA — so your evidence holds up
              in court, in grant applications, and in policy hearings.
            </p>
            <Link
              to="/methodology"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-forest-deep hover:text-moss"
            >
              Read the full methodology <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="ring-soft rounded-xl border border-border bg-card p-6 font-mono text-sm leading-relaxed">
            <div className="text-muted-foreground"># NDVI per pixel (Sentinel-2 L2A)</div>
            <div><span className="text-moss">red</span>  = image.select(<span className="text-earth">'B04'</span>)</div>
            <div><span className="text-moss">nir</span>  = image.select(<span className="text-earth">'B08'</span>)</div>
            <div><span className="text-moss">ndvi</span> = (nir − red) / (nir + red)</div>
            <div className="mt-3 text-muted-foreground"># Deforestation detection mask</div>
            <div><span className="text-moss">Δ</span>    = ndvi_after − ndvi_before</div>
            <div><span className="text-moss">loss</span> = Δ &lt; −threshold ∧ ndvi_before &gt; 0.5</div>
            <div><span className="text-moss">ha</span>   = loss.pixelArea().sum() / 10_000</div>
            <div className="mt-3 text-muted-foreground"># Data source: Element84 Earth Search</div>
            <div><span className="text-moss">stac</span> = earth-search.aws.element84.com/v1</div>
            <div><span className="text-moss">coll</span> = <span className="text-earth">"sentinel-2-l2a"</span></div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-moss">Who Uses Retreeval</p>
          <h2 className="mt-3 text-4xl">Built for the organizations that matter.</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Environmental Nonprofits",
              body: "Generate court-admissible deforestation evidence for campaigns, legal filings and donor reports — without a dedicated remote-sensing team.",
              tags: ["Evidence packs", "PDF exports", "Alert thresholds"],
            },
            {
              title: "Academic Researchers",
              body: "Query the Sentinel-2 archive for any region and date range. Download CSV time-series and NDVI rasters for peer-reviewed publications.",
              tags: ["STAC API access", "CSV downloads", "Reproducible"],
            },
            {
              title: "Government Agencies",
              body: "Monitor permit compliance and protected-area integrity across large jurisdictions with automated weekly scans and threshold alerts.",
              tags: ["Multi-region", "Compliance reports", "Webhook alerts"],
            },
          ].map(({ title, body, tags }) => (
            <div
              key={title}
              className="ring-soft rounded-xl border border-border bg-card p-6 flex flex-col"
            >
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground flex-1">{body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-forest-deep"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <h2 className="mx-auto max-w-3xl text-4xl">
            If you're protecting a forest,<br />we'll help you prove what's happening to it.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Retreeval is free for accredited environmental nonprofits, academic researchers
            and public agencies. No account needed to run your first analysis.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 rounded-md bg-forest-deep px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-forest"
            >
              Start your first analysis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Explore the dashboard
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
