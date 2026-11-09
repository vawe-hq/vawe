"use client";

import { useEffect } from "react";

// A section is the one being read once its top passes this share of the screen height.
const READ_LINE = 0.3;

// A bar of chips that scrolls sideways (the moves categories on a phone) brings the current chip to its middle.
function showInBar(link: HTMLElement) {
  const bar = link.closest("nav");
  if (!bar || bar.scrollWidth <= bar.clientWidth) return;
  const delta = link.getBoundingClientRect().left - bar.getBoundingClientRect().left;
  const left = bar.scrollLeft + delta - (bar.clientWidth - link.offsetWidth) / 2;
  const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  bar.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
}

// The links are found again on each update, because a filter can change which sections exist.
export function ScrollSpy({ nav }: { nav: string }) {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const links = [...document.querySelectorAll<HTMLAnchorElement>(`${nav} a[href^="#"]`)];
      const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
      let current = -1;
      targets.forEach((t, i) => {
        if (t && t.getBoundingClientRect().top <= innerHeight * READ_LINE) current = i;
      });
      if (atEnd && current >= 0) current = targets.length - 1;
      links.forEach((a, i) => {
        if (i !== current) return a.removeAttribute("aria-current");
        if (a.hasAttribute("aria-current")) return;
        a.setAttribute("aria-current", "location");
        showInBar(a);
      });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    update();
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [nav]);
  return null;
}
