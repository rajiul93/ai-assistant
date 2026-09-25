import type { MetadataRoute } from "next";

/** Lets phones install the app to the home screen and open it full screen, like a native app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Prep — Job Preparation",
    short_name: "Prep",
    description: "Personal job preparation and study management.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
