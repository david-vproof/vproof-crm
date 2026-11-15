import { ImageResponse } from "next/og";

import { SegellApp } from "@/components/SegellApp";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS arrodoneix les cantonades pel seu compte: el fons va de banda a banda. */
export default function AppleIcon() {
  return new ImageResponse(<SegellApp mida={size.width} radi={0} escala={0.6} />, size);
}
