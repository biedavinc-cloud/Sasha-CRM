import React, { useState } from "react";

// Logo with graceful fallbacks, so the brand never shows a broken image:
//   1) /logo.png            -> put your own file in public/logo.png (recommended)
//   2) the previously hosted copy
//   3) a monogram
const LEGACY_LOGO = "https://media.base44.com/images/public/6ac79288ee14219d24c0ade5/ed87ef57a_SashaAestheticsLogo-4.png";

export default function BrandLogo({ className = "w-12 h-12 rounded-full", alt = "Sasha Aesthetics" }) {
  const [src, setSrc] = useState("/logo.png");
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div role="img" aria-label={alt} className={`${className} bg-neutral-900 text-white flex items-center justify-center font-semibold`}>S</div>;
  }
  return <img src={src} alt={alt} className={`${className} object-cover`} onError={() => (src === "/logo.png" ? setSrc(LEGACY_LOGO) : setFailed(true))} />;
}
