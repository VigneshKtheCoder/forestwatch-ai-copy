import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology · Retreeval" },
      { name: "description", content: "How Retreeval fetches Sentinel-2 L2A imagery, computes NDVI, estimates hectare loss and scores confidence." },
    ],
  }),
  component: Methodology,
});

function Methodology() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.18em] text-moss">Methodology</p>
        <h1 className="mt-3 text-4xl">How we measure forest loss.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Every value shown on the Analyze page is computed live from a single Sentinel-2 Level-2A scene per epoch,
          pulled at request time from a public open-data archive. This page documents exactly what we ask the
          backend for, what we compute on top, and where the approximations are.
        </p>

        <section className="prose prose-neutral mt-12 max-w-none text-foreground">
          <h2 className="mt-12 text-2xl">1. Data source</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <a className="text-moss hover:text-forest-deep" href="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2" target="_blank" rel="noreferrer">Sentinel-2 Level-2A</a>
            {" "}surface-reflectance imagery from the ESA Copernicus programme, indexed by the
            {" "}<a className="text-moss hover:text-forest-deep" href="https://planetarycomputer.microsoft.com/dataset/sentinel-2-l2a" target="_blank" rel="noreferrer">Microsoft Planetary Computer</a>
            {" "}STAC catalogue. We query <code className="font-mono text-xs">collections=["sentinel-2-l2a"]</code> with
            <code className="font-mono text-xs"> eo:cloud_cover {"<"} maxCloud</code> and pick the lowest-cloud
            item that intersects the AOI in each date window.
          </p>

          <h2 className="mt-10 text-2xl">2. NDVI computation</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Per the <a className="text-moss hover:text-forest-deep" href="https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index" target="_blank" rel="noreferrer">USGS NDVI definition</a>,
            using Sentinel-2 bands B04 (Red, 665 nm) and B08 (NIR, 842 nm), both at 10 m native resolution:
          </p>
          <pre className="ring-soft mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
NDVI = (NIR − RED) / (NIR + RED)
     = (B08 − B04) / (B08 + B04)
          </pre>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            The NDVI raster is never transmitted to the browser. Instead we POST the AOI polygon to the Planetary
            Computer Titiler endpoint <code className="font-mono text-xs">/data/v1/item/statistics</code> with the
            expression above, and ask for a 20-bin histogram over the range [−1, 1]. The endpoint streams the
            scene's B04 and B08 COGs, evaluates the expression, masks invalid pixels and returns
            <code className="font-mono text-xs"> {"{min, max, mean, std, valid_pixels, masked_pixels, histogram}"}</code>.
          </p>

          <h2 className="mt-10 text-2xl">3. Forest-loss estimation</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            For each epoch we compute the <em>forested fraction</em> as the share of valid AOI pixels whose NDVI is
            at or above the configurable forest threshold τ (default 0.50, following Hansen et al. canopy-cover
            conventions). Hectare loss is then:
          </p>
          <pre className="ring-soft mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4 font-mono text-sm">
lossFraction = max(0, forestFraction(before, τ) − forestFraction(after, τ))
lossHa       = lossFraction × areaHa(AOI)
          </pre>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <strong>Important approximation:</strong> because the statistics endpoint summarises each scene
            independently, the loss figure is a histogram-difference estimate, not a true per-pixel change-detection
            map. It captures net reduction in forested area but cannot distinguish localised loss from spatially
            distributed degradation. For pixel-exact change attribution we plan to add a server-side
            <code className="font-mono text-xs"> /crop</code> raster diff in a follow-up.
          </p>

          <h2 className="mt-10 text-2xl">4. AOI area</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Polygon area is computed in JavaScript with the spherical-excess formula on the WGS-84 sphere
            (radius 6 378 137 m), then converted to hectares. No projection step — accurate to within ~0.5% for AOIs
            smaller than a few thousand km².
          </p>

          <h2 className="mt-10 text-2xl">5. Confidence score</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            A 0–1 score combining valid-pixel ratio (40% weight each for the before/after scenes) and a 20%
            cloud-cover penalty driven by the worst of the two scenes. Low scores typically mean the AOI is mostly
            clouded out — increase the cloud threshold or widen the date window.
          </p>

          <h2 className="mt-10 text-2xl">6. Reproducibility</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            Each analysis returns the exact Sentinel-2 scene IDs used (e.g. <code className="font-mono text-xs">S2B_MSIL2A_20240805T141049_R110_T20LMR_20240805T194717</code>).
            Anyone can reproduce the result by re-querying the Planetary Computer STAC API with the same item ID
            and the same AOI polygon — or download the raw COGs from
            <a className="text-moss hover:text-forest-deep" href="https://registry.opendata.aws/sentinel-2-l2a-cogs/" target="_blank" rel="noreferrer"> AWS Open Data</a>
            {" "}and replicate offline.
          </p>

          <h2 className="mt-10 text-2xl">7. Known limitations</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-muted-foreground">
            <li>Single-scene comparison; no multi-scene compositing yet. A persistently cloudy AOI may return an unrepresentative scene.</li>
            <li>NDVI cannot distinguish forest from other dense vegetation (e.g. mature plantations). Cross-checking with
              <a className="text-moss hover:text-forest-deep" href="https://data.globalretreeval.org" target="_blank" rel="noreferrer"> Global Forest Watch</a> and
              <a className="text-moss hover:text-forest-deep" href="https://glad.earthengine.app/view/global-forest-change" target="_blank" rel="noreferrer"> Hansen Global Forest Change</a> is recommended for definitive loss attribution.
            </li>
            <li>Sentinel-2 L2A coverage starts March 2017 globally; before that, no data will be returned.</li>
            <li>The CNN land-cover classifier (Forested / Deforested / Water / Urban / Agriculture / Other) is on the roadmap; current land-cover charts on the dashboard are illustrative reference values.</li>
          </ul>

          <h2 className="mt-10 text-2xl">8. Further reading</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 leading-relaxed text-muted-foreground">
            <li><a className="text-moss hover:text-forest-deep" href="https://planetarycomputer.microsoft.com/docs/concepts/sas/" target="_blank" rel="noreferrer">Planetary Computer · Data access & SAS</a></li>
            <li><a className="text-moss hover:text-forest-deep" href="https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED" target="_blank" rel="noreferrer">GEE · Sentinel-2 SR Harmonized catalog</a></li>
            <li><a className="text-moss hover:text-forest-deep" href="https://github.com/satellite-image-deep-learning/datasets" target="_blank" rel="noreferrer">Open satellite-image datasets for ML</a></li>
          </ul>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
