/**
 * Selected work. The first two are the REAL, named, publicly-reachable
 * products from the CV (IRIS and Young Pro) — those lead. The rest are
 * capability cards describing recurring work types.
 *
 * Field shape is load-bearing: `ProjectCard` reads `id`, `name`,
 * `tagline`, `stack`, `description`, `color`. Do not rename.
 * `url` / `urlLabel` are OPTIONAL — a card only renders a live link when
 * both are present.
 */

export interface Project {
  id: string;
  name: string;
  tagline: string;
  stack: ReadonlyArray<string>;
  description: string;
  color: string;
  /** Public URL of the shipped product, when there is one to link. */
  url?: string;
  /** Display form of `url` (no scheme), e.g. "iris26.variableq.com". */
  urlLabel?: string;
  /** Short role credit shown above the title. */
  role?: string;
}

export const projects: ReadonlyArray<Project> = [
  {
    id: "iris-enterprise",
    name: "IRIS",
    tagline: "Enterprise platform — UI system, auth and dashboards from scratch.",
    role: "Frontend lead",
    url: "https://iris26.variableq.com",
    urlLabel: "iris26.variableq.com",
    stack: ["Next.js", "Redux Toolkit", "Tailwind CSS", "REST APIs", "GCP"],
    description:
      "Led frontend architecture for IRIS, a Next.js enterprise platform — designed the complete UI system, authentication flow and dashboard modules from scratch. Multi-step workflows run on Redux Toolkit so data stays consistent across deeply nested components and route transitions. Tuned with SSR and code splitting, deployed on GCP with custom domain, SSL and CI/CD.",
    color: "#4f9cff"
  },
  {
    id: "young-pro",
    name: "Young Pro",
    tagline: "Career-networking platform on web, iOS and Android.",
    role: "Web + mobile",
    url: "https://youngprofessionals.global",
    urlLabel: "youngprofessionals.global",
    stack: ["Next.js", "React Native", "Redux Toolkit", "React Query", "EAS"],
    description:
      "An end-to-end career-networking product: a Next.js web app plus a React Native mobile app published to both the Apple App Store and Google Play Store. I owned the full submission lifecycle — code signing, TestFlight betas, Play Console setup, compliance review and post-launch updates — and shared Redux/React Query state between web and mobile to keep the business logic DRY.",
    color: "#00d4ff"
  },
  {
    id: "ai-integrated-webapp",
    name: "AI-Integrated Web App",
    tagline: "Claude, GPT-4 and Gemini wired into a production Next.js app.",
    stack: ["Next.js", "Claude API", "OpenAI API", "Gemini API", "Redux Toolkit"],
    description:
      "Production Next.js application with AI assistance built in across three providers — streaming responses, prompt pipelines and graceful fallback between Claude, GPT-4 and Gemini. Prompt state lives in Redux Toolkit so the interface stays responsive while tokens arrive.",
    color: "#9b5cff"
  },
  {
    id: "cloud-cicd-pipeline",
    name: "Cloud + CI/CD Pipeline",
    tagline: "Next.js on Azure / GCP with automated delivery.",
    stack: ["Azure", "GCP", "GitHub Actions", "Nginx", "SSL/TLS"],
    description:
      "End-to-end deployment path for Next.js apps: VM provisioning, Nginx reverse proxy, domain and SSL setup, plus GitHub Actions pipelines that take a push on main and ship it to production with no manual steps.",
    color: "#ff8a3c"
  },
  {
    id: "wordpress-build",
    name: "WordPress Build",
    tagline: "Figma → pixel-perfect WordPress theme + plugins.",
    stack: ["WordPress", "PHP", "Elementor", "WooCommerce", "ACF"],
    description:
      "Figma-to-WordPress delivery with theme customisation, layout implementation and plugin integration — cross-browser tested and tuned so content editors can publish without a developer in the loop.",
    color: "#39ffa5"
  }
];

export default projects;
