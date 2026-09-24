import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iPhone home-screen icon (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)", color: "#fafafa", fontSize: 100, fontWeight: 700, letterSpacing: -4 }}>
        P
      </div>
    ),
    size,
  );
}
