# DEV.OS — Pradipta Kumar Jana

A single long-scroll portfolio built as a fictional operating system. Scroll is
the only control: it cranes a drone down a Firewatch-style parallax valley,
types a cold-boot log into a live terminal, resolves a portrait out of a WebGL
halftone, and cycles a set of stat gauges — all driven from one scroll position.

Next.js 14 · React Three Fiber · GSAP 3 · Tailwind.

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

Node 20 (see `.nvmrc`).

> Measure performance against `npm run build && npm run start`, never `npm run dev`.
> Dev mode runs unminified React with HMR instrumentation and its frame times are
> not representative.

## Commands

| Command             | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Dev server at http://localhost:3000       |
| `npm run build`     | Production build                          |
| `npm run start`     | Serve the production build                |
| `npm run lint`      | `next lint`                               |
| `npm run typecheck` | `tsc --noEmit`                            |

## Environment

Nothing is required. `lib/siteUrl.ts` holds the canonical production domain,
so a normal deploy resolves correctly with no configuration.

`NEXT_PUBLIC_SITE_URL` exists as an override for forks and staging hosts:

```
NEXT_PUBLIC_SITE_URL=https://some-other-host.com
```

Whatever resolves is the origin that `metadataBase`, the canonical link,
`robots.txt` and `sitemap.xml` all point at — and the host WhatsApp, LinkedIn
and Slack fetch `og:image` from.

**When the domain changes, edit `PRODUCTION_URL` in `lib/siteUrl.ts`.** Do not
rely on Vercel's `VERCEL_PROJECT_PRODUCTION_URL`: on this project it returns
the auto-generated `*.vercel.app` host rather than the domain actually attached
to it, which silently made every canonical URL wrong.

## Deploy

Built for Vercel — import the repo and it builds with zero configuration.

1. **New Project → import this repository.** Framework preset: Next.js.
2. Deploy. No environment variables needed.

`vercel.json` pins the serverless region to `iad1` and sets baseline security
headers. The region only affects the on-demand routes (`/opengraph-image`,
`/icon`, `/apple-icon`); everything else is static and served from the edge.
Switch it to `bom1` if most visitors are in India.

After deploying, confirm the metadata points at the right host:

```bash
curl -s https://pradipta-jana.vercel.app/robots.txt   # Host: + Sitemap: lines
curl -sI https://pradipta-jana.vercel.app/opengraph-image | head -2   # 1200x630 PNG
```

## How the scroll engine works

One `ScrollTrigger` spanning the document writes normalized progress into
`lib/sceneStore.ts`. The 3D scene never receives a GSAP tween — it samples a
pose curve (`lib/scenePoses.ts`) at that progress and damps toward it inside the
render loop, which is what keeps scrolling smooth. Sections layer their own
`ScrollTrigger`s on top for pinned and scrubbed choreography.

Every scroll-driven DOM effect shares a single rAF (`lib/frameLoop.ts`): one read
phase per frame (scroll position, viewport, damped pointer), then all
subscribers write. Independent loops reading layout between each other's style
writes is a reliable way to lose a frame.

## Degradation

Narrow viewports, low core counts, software GPUs and `prefers-reduced-motion`
never mount the WebGL canvas — `components/SvgCoreFallback.tsx` stands in, pinned
sections collapse to a single viewport, and every scroll-scrubbed animation
renders its settled end state.

## Layout

```
app/            routes, metadata, OG/icon/manifest generators
components/
  sections/     one file per scroll section
  three/        R3F scenes and shaders
  ui/           HUD, overlays, shared primitives
content/        profile, projects, skills, experience copy
lib/            scroll engine, frame loop, perf tiers, GSAP registrar
assets/         source art the shipped WebP is derived from (not deployed)
```
