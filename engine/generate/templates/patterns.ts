/**
 * Common component templates — structural skeletons for frequently encountered
 * UI patterns. Each template provides a match heuristic and a code generator
 * that emits a minimal, well-typed React component. The generation pipeline
 * fills in exact styles and content from the extraction data.
 */

import type { ComponentTemplate, TemplateContext } from './index';

// ---------------------------------------------------------------------------
// 1. Sticky Header
// ---------------------------------------------------------------------------

export const stickyHeaderTemplate: ComponentTemplate = {
  name: 'StickyHeader',
  description: 'Fixed/sticky navigation header with logo and nav links',
  matchPattern: (name) => (/header|nav|navigation|top-bar/i.test(name) ? 0.8 : 0),
  generateCode: (ctx) => `"use client";
import { useState, useEffect } from "react";

export function ${ctx.componentName}() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={\`fixed top-0 w-full z-50 transition-all \${scrolled ? "bg-black/80 backdrop-blur-md" : "bg-transparent"}\`}>
      <nav className="mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo */}
        {/* Nav links */}
        {/* CTA button */}
      </nav>
    </header>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 2. Hero with Video
// ---------------------------------------------------------------------------

export const heroWithVideoTemplate: ComponentTemplate = {
  name: 'HeroWithVideo',
  description: 'Full-screen hero section with video background and text overlay',
  matchPattern: (name) => (/hero|banner|intro|splash/i.test(name) ? 0.7 : 0),
  generateCode: (ctx) => `"use client";
import { useRef } from "react";

export function ${ctx.componentName}() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <section className="relative h-screen overflow-hidden">
      <video ref={videoRef} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>
      <div className="relative z-10 flex items-center justify-center h-full">
        {/* Heading text */}
        {/* CTA */}
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 3. Feature Grid
// ---------------------------------------------------------------------------

export const featureGridTemplate: ComponentTemplate = {
  name: 'FeatureGrid',
  description: 'Grid of feature cards with icons and descriptions',
  matchPattern: (name, elementCount) => {
    const nameScore = /feature|benefit|service|capability|advantage/i.test(name) ? 0.6 : 0;
    const countBonus = elementCount >= 3 && elementCount <= 12 ? 0.2 : 0;
    return nameScore + countBonus;
  },
  generateCode: (ctx) => `export function ${ctx.componentName}() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-7xl">
        {/* Section heading */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Feature cards */}
        </div>
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 4. Logo Grid / Trusted By
// ---------------------------------------------------------------------------

export const logoGridTemplate: ComponentTemplate = {
  name: 'LogoGrid',
  description: 'Row or grid of partner/client logos',
  matchPattern: (name) => (/logo|partner|client|trusted|brand|sponsor/i.test(name) ? 0.75 : 0),
  generateCode: (ctx) => `export function ${ctx.componentName}() {
  return (
    <section className="py-16 px-6">
      <div className="mx-auto max-w-5xl text-center">
        {/* Optional label */}
        <div className="flex flex-wrap items-center justify-center gap-8">
          {/* Logo images */}
        </div>
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 5. Testimonial
// ---------------------------------------------------------------------------

export const testimonialTemplate: ComponentTemplate = {
  name: 'Testimonial',
  description: 'Testimonial or quote section with avatar and attribution',
  matchPattern: (name) => (/testimonial|review|quote|feedback|social-proof/i.test(name) ? 0.75 : 0),
  generateCode: (ctx) => `export function ${ctx.componentName}() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-4xl text-center">
        {/* Quote text */}
        <div className="mt-8 flex items-center justify-center gap-4">
          {/* Avatar */}
          {/* Name and role */}
        </div>
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 6. CTA Banner
// ---------------------------------------------------------------------------

export const ctaBannerTemplate: ComponentTemplate = {
  name: 'CtaBanner',
  description: 'Call-to-action banner with heading, description, and button(s)',
  matchPattern: (name) => (/cta|call-to-action|get-started|sign-up|subscribe/i.test(name) ? 0.7 : 0),
  generateCode: (ctx) => `export function ${ctx.componentName}() {
  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-3xl text-center">
        {/* Heading */}
        {/* Description */}
        <div className="mt-8 flex items-center justify-center gap-4">
          {/* Primary CTA button */}
          {/* Secondary CTA button */}
        </div>
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 7. Contact Form
// ---------------------------------------------------------------------------

export const contactFormTemplate: ComponentTemplate = {
  name: 'ContactForm',
  description: 'Contact or lead-capture form with text inputs and submit button',
  matchPattern: (name) => (/contact|form|enquir|lead|message/i.test(name) ? 0.7 : 0),
  generateCode: (ctx) => `"use client";
import { useState, type FormEvent } from "react";

export function ${ctx.componentName}() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <section className="py-24 px-6 text-center">
        <p>Thank you for your message!</p>
      </section>
    );
  }

  return (
    <section className="py-24 px-6">
      <div className="mx-auto max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Name input */}
          {/* Email input */}
          {/* Message textarea */}
          {/* Submit button */}
        </form>
      </div>
    </section>
  );
}
`,
};

// ---------------------------------------------------------------------------
// 8. Footer
// ---------------------------------------------------------------------------

export const footerTemplate: ComponentTemplate = {
  name: 'Footer',
  description: 'Page footer with link columns, logo, and copyright',
  matchPattern: (name) => (/footer|bottom|colophon/i.test(name) ? 0.85 : 0),
  generateCode: (ctx) => `export function ${ctx.componentName}() {
  return (
    <footer className="py-16 px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Logo column */}
          {/* Link columns */}
        </div>
        <div className="mt-12 border-t pt-8 text-sm opacity-60">
          {/* Copyright */}
        </div>
      </div>
    </footer>
  );
}
`,
};
