import React from "react";
import { Image } from "@/components/ui/image";

const LOGO_URL =
  "https://media.api.com/images/public/6ac79288ee14219d24c0ade5/ed87ef57a_SashaAestheticsLogo-4.png";
const BG_IMAGE =
  "https://images.unsplash.com/photo-1631730486572-226e5cabe731?w=1200&q=80";

export default function AuthLayout({ icon: _icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex">
      {/* Branded panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <img
          src={BG_IMAGE}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/85 via-black/70 to-black/85" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <Image
              src={LOGO_URL}
              alt="Sasha Aesthetics"
              className="w-12 h-12 rounded-full"
              fittingType="fill"
            />
            <span className="font-heading text-lg font-semibold tracking-[0.2em] uppercase">
              Sasha Aesthetics
            </span>
          </div>
          <div>
            <h2 className="font-heading text-4xl font-bold leading-tight mb-4">
              Where Beauty
              <br />
              Meets Precision
            </h2>
            <p className="text-white/60 text-base max-w-md leading-relaxed">
              Sasha Connect — the exclusive partner portal for Sasha Aesthetic
              Clinic, JVC Dubai.
            </p>
          </div>
          <p className="text-white/30 text-xs tracking-wide">
            © 2026 Sasha Aesthetic Clinic. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <Image
              src={LOGO_URL}
              alt="Sasha Aesthetics"
              className="w-16 h-16 rounded-full"
              fittingType="fill"
            />
          </div>
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && (
              <p className="text-muted-foreground mt-2">{subtitle}</p>
            )}
          </div>
          <div className="bg-card border border-border p-8 shadow-sm rounded-none">
            {children}
          </div>
          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {footer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}