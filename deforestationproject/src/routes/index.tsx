import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { NdviTile, NdviLegend } from "@/components/ndvi-tile";
import { ArrowRight, Satellite, LineChart, ShieldCheck, FileDown, Globe2, Trees } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ForestWatch AI · Satellite deforestation monitoring for conservation" },
      { name: "description", content: "Detect, measure and report forest loss anywhere on Earth using Sentinel-2 imagery, NDVI change detection and ML — built for nonprofits, researchers and agencies." },
      { property: "og:title", content: "ForestWatch AI" },
      { property: "og:description", content: "Open satellite intelligence for the organizations protecting the world's forests." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="hero-grad relative overflow-hidden text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs tracking-wide text-sage">
              <Satellite className="h-3.5 w-3.5" /> Sentinel-2 · Google Earth Engine · NDVI
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] tracking-tight md:text-6xl">
              The forest is changing.<br />
              <span className="text-sage">See it from orbit.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75">
              ForestWatch AI turns free European Space Agency imagery into hectare-accurate
              deforestation evidence — for nonprofits, researchers and government agencies
              defending the world's last intact ecosystems.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/analyze" className="inline-flex items-center gap-2 rounded-md bg-sage px-5 py-3 text-sm font-medium text-forest-deep transition hover:bg-white">
                Run a free analysis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                View live dashboard
              </Link>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 text-left">
              {[
                ["1.2M+", "ha monitored"],
                ["38", "active regions"],
                ["< 6 d", "revisit time"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="font-display text-3xl text-white">{n}</dt>
                  <dd className="text-xs uppercase tracking-wider text-white/55">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* NDVI comparison preview */}
          <div className="relative">
            <div className="ring-soft rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="mb-3 flex items-center justify-between text-xs text-white/70">
                <span>Rondônia Corridor · Brazil</span>
                <span>10°50′S 63°20′W</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NdviTile seed={2} decline={0.05} label="2019-08" size={260} />
                <NdviTile seed={2} decline={0.55} label="2024-08" size={260} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <NdviLegend />
                <span className="rounded-md bg-alert/90 px-2 py-1 text-[11px] font-medium text-white">
                  −0.27 ΔNDVI · 18,420 ha
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-moss">Platform</p>
          <h2 className="mt-3 text-4xl">A complete deforestation pipeline, in your browser.</h2>
          <p className="mt-4 text-muted-foreground">
            From scene selection to publication-ready reports — every step uses peer-reviewed
            remote-sensing methods and 100% open data.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: Globe2, title: "Choose any region", body: "Draw an AOI on an interactive global map. We fetch cloud-filtered Sentinel-2 scenes for the dates you pick." },
            { icon: LineChart, title: "Quantify the loss", body: "NDVI = (NIR − RED)/(NIR + RED), per pixel, between two epochs. Significant declines convert to hectares lost." },
            { icon: Trees, title: "Classify land cover", body: "A CNN backbone classifies patches into Forested, Deforested, Water, Agriculture, Urban and Other." },
            { icon: ShieldCheck, title: "Custom alert thresholds", body: "Set ΔNDVI and area thresholds per region. Email & webhook alerts when a scan crosses them." },
            { icon: FileDown, title: "Publication-ready exports", body: "Download PDF reports, PNG heatmaps and CSV time-series for grants, advocacy and policy work." },
            { icon: Satellite, title: "Open data, forever", body: "Built on Copernicus, USGS and Global Forest Watch — no proprietary lock-in, ever." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="ring-soft rounded-xl border border-border bg-card p-6">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-forest-deep">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Methodology strip */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-moss">Methodology</p>
            <h2 className="mt-3 text-3xl">Scientifically defensible by default.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every metric ForestWatch produces is reproducible from raw Sentinel-2 L2A imagery
              using the same equations cited by the USGS and ESA.
            </p>
            <Link to="/methodology" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-forest-deep hover:text-moss">
              Read the full methodology <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="ring-soft rounded-xl border border-border bg-card p-6 font-mono text-sm leading-relaxed">
            <div className="text-muted-foreground"># NDVI per pixel (Sentinel-2 L2A)</div>
            <div><span className="text-moss">red</span>  = image.select(<span className="text-earth">'B4'</span>)</div>
            <div><span className="text-moss">nir</span>  = image.select(<span className="text-earth">'B8'</span>)</div>
            <div><span className="text-moss">ndvi</span> = (nir − red) / (nir + red)</div>
            <div className="mt-3 text-muted-foreground"># Deforestation mask</div>
            <div><span className="text-moss">Δ</span>    = ndvi_after − ndvi_before</div>
            <div><span className="text-moss">loss</span> = Δ &lt; −threshold ∧ ndvi_before &gt; 0.5</div>
            <div><span className="text-moss">ha</span>   = loss.pixelArea().sum() / 10_000</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-3xl text-4xl">
          If you're protecting a forest, we'll help you prove what's happening to it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          ForestWatch AI is free for accredited environmental nonprofits, academic researchers
          and public agencies.
        </p>
        <Link to="/analyze" className="mt-8 inline-flex items-center gap-2 rounded-md bg-forest-deep px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-forest">
          Start your first analysis <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}
