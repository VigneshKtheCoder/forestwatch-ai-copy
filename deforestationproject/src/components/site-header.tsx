import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-forest-deep text-primary-foreground">
            <Leaf className="h-4 w-4" />
          </span>
          <span className="font-display text-lg tracking-tight">
            Retreeval
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "text-foreground" }}>Overview</Link>
          <Link to="/dashboard" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Dashboard</Link>
          <Link to="/analyze" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Analyze</Link>
          <Link to="/methodology" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Methodology</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="hidden text-sm text-muted-foreground hover:text-foreground sm:block">Sign in</Link>
          <Link to="/analyze" className="inline-flex h-9 items-center rounded-md bg-forest-deep px-4 text-sm font-medium text-primary-foreground transition hover:bg-forest">
            Launch analysis
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-forest-deep text-primary-foreground"><Leaf className="h-3.5 w-3.5" /></span>
            <span className="font-display">Retreeval</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Open satellite intelligence for the organizations protecting the world's forests.</p>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">Data</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><a href="https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-2" target="_blank" rel="noreferrer" className="hover:text-foreground">Copernicus Sentinel-2</a></li>
            <li><a href="https://earthengine.google.com" target="_blank" rel="noreferrer" className="hover:text-foreground">Google Earth Engine</a></li>
            <li><a href="https://data.globalforestwatch.org" target="_blank" rel="noreferrer" className="hover:text-foreground">Global Forest Watch</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">Method</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><a href="https://www.usgs.gov/landsat-missions/landsat-normalized-difference-vegetation-index" target="_blank" rel="noreferrer" className="hover:text-foreground">USGS NDVI guide</a></li>
            <li><a href="https://developers.google.com/earth-engine" target="_blank" rel="noreferrer" className="hover:text-foreground">Earth Engine docs</a></li>
            <li><a href="https://github.com/satellite-image-deep-learning/datasets" target="_blank" rel="noreferrer" className="hover:text-foreground">SatML datasets</a></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-2 font-medium">Organization</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>For nonprofits & research</li>
            <li>Free for conservation use</li>
            <li>contact@retreeval.ai</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        © 2026 Retreeval · Built on open Earth observation data
      </div>
    </footer>
  );
}
