import { ImageResponse } from "next/og";

// PNG app icons for the home-screen install (manifest) and the browser tab.
export function generateImageMetadata() {
  return [192, 512].map((size) => ({ id: String(size), contentType: "image/png", size: { width: size, height: size } }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)", color: "#fafafa", fontSize: size * 0.56, fontWeight: 700, letterSpacing: -size * 0.02 }}>
        P
      </div>
    ),
    { width: size, height: size },
  );
}
