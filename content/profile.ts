/**
 * Owner persona, used across Hero/About/Contact copy.
 *
 * Field shape is load-bearing: sections import `profile.stats`,
 * `profile.roles`, `profile.socials`, `profile.summary`, etc.
 * Do not rename fields without updating the section files.
 */

export interface SocialLinks {
  github: string;
  /**
   * How the GitHub account is DISPLAYED. The account is `PradiptaJanaNew`
   * (the plain handle was taken), which reads awkwardly on a CV, so the UI
   * shows a clean label while every link still points at the real profile.
   * Never build a URL out of this.
   */
  githubLabel: string;
  linkedin: string;
  x: string;
  email: string;
  phone: string;
}

export interface Profile {
  name: string;
  role: string;
  location: string;
  tagline: string;
  summary: string;
  bio: string;
  stats: ReadonlyArray<{ label: string; value: string }>;
  roles: ReadonlyArray<string>;
  socials: SocialLinks;
  education: { degree: string; school: string };
  availability: string;
  /** Public path to the downloadable CV in /public. */
  cvPath: string;
  cvFileName: string;
}

export const profile: Profile = {
  name: "Pradipta Kumar Jana",
  role: "Senior Software Engineer",
  location: "Sonarpur, Kolkata — IN",
  tagline:
    "A web developer shipping Next.js, React Native and cloud-deployed apps from a single command surface.",
  summary:
    "I build and ship production web and mobile apps across the full stack — Next.js, React, React Native (Expo), Django and WordPress — and own the deploy path on Azure and GCP end-to-end: VM setup, domains, SSL and CI/CD.",
  bio:
    "3+ years of shipping production software at Bitpastel Solution and Proclivity Digitech. I lead frontend work on Next.js + React projects, integrate AI features with OpenAI and Gemini APIs, and run the cloud infra behind them — VM instances, SSL, domain routing, and CI/CD pipelines on Azure and GCP. Currently extending the same stack to mobile with React Native + Expo for both Android and iOS.",
  stats: [
    { label: "years_dev", value: "3+" },
    { label: "stacks", value: "5" },
    { label: "clouds", value: "2" },
    { label: "platforms", value: "web · mobile · cloud" }
  ],
  roles: ["Frontend", "Full-Stack", "React Native", "Cloud / DevOps", "WordPress"],
  socials: {
    github: "https://github.com/PradiptaJanaNew",
    githubLabel: "pradiptajana",
    linkedin: "https://www.linkedin.com/in/pradiptakumarjana",
    x: "https://x.com/",
    email: "pradiptajana.co@gmail.com",
    phone: "+91 83484 42126"
  },
  education: {
    degree: "Bachelor of Computer Applications (BCA)",
    school: "George Group of Colleges, Sealdah, Kolkata"
  },
  availability: "Immediate joiner — open to full-time roles, hybrid in Kolkata or fully remote.",
  cvPath: "/Pradipta_Kumar_Jana_CV.pdf",
  cvFileName: "Pradipta_Kumar_Jana_CV.pdf"
};

export default profile;
