// The words of the three submit pages, shared by the HTML pages and their markdown copies.

export const SUBMIT_PAGES = {
  listing: {
    path: "/marketplace/submit",
    folder: "marketplace/listings",
    title: "List your motion design template | vawe",
    h1: "List your template.",
    description: "List an After Effects, Premiere Pro, Final Cut Pro, DaVinci Resolve, Motion or vawe template. It links to your own store, and you keep 100% of every sale.",
    intro: [
      "List a template you made, free or paid. Buyers go to your own store: Polar, Gumroad, Lemon Squeezy or any https link. vawe takes no cut and holds no money.",
      "Link a preview video and a poster image, or leave them empty and add the files to the pull request. Every listing is read by a person before it goes live.",
    ],
    done: "Your listing is now a pull request on GitHub. When the owner merges it, it goes live on the marketplace and on your creator page.",
  },
  job: {
    path: "/jobs/post",
    folder: "marketplace/jobs",
    title: "Post a motion design job, free | vawe",
    h1: "Post a motion design job.",
    description: "Post a motion design job for free. Say where the work happens, the pay and how to apply. The job stays up for 60 days.",
    intro: [
      "Posting is free. Say what the work is, where it happens, the pay if you can, and how people apply. The job stays up for 60 days, then it closes on its own.",
      "Every job is read by a person before it goes live. Jobs that ask people to pay, or that collect CVs for no real role, are turned down.",
    ],
    done: "Your job is now a pull request on GitHub. When the owner merges it, it goes live on the jobs board for 60 days.",
  },
  designer: {
    path: "/hire/join",
    folder: "marketplace/designers",
    title: "Add your motion designer profile | vawe",
    h1: "Get hired.",
    description: "Add a hire-me profile: your reel, the software you use, your rate and when you are free. Companies contact you directly.",
    intro: [
      "Add your reel, the software you use, your rate and when you are free. Companies contact you directly, through your own site or reel. vawe takes no fee.",
      "Your profile lives at vawe.dev/creators/<handle>, next to any templates you list. Change it later with a pull request on the same file.",
    ],
    done: "Your profile is now a pull request on GitHub. When the owner merges it, it goes live on the hire page and on your creator page.",
  },
} as const;

export const EMPTY = {
  listing: "Made a template for After Effects, Premiere Pro, Final Cut Pro, DaVinci Resolve, Motion or vawe? List it here. It links to your own store and you keep every sale.",
  job: "Hiring a motion designer? Post the job here for free. Say where the work happens, the pay and how to apply.",
  designer: "Are you a motion designer open to work? Add your reel, your software, your rate and when you are free. Companies contact you directly.",
} as const;
