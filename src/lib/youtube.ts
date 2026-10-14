/** Free users keep this many videos; a running plan (or an admin) has no limit. */
export const FREE_VIDEO_LIMIT = 5;

const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id from any common YouTube link — watch?v=, youtu.be/, shorts/, live/, embed/,
 * m. and music. hosts, with extra parameters — or a bare 11-character id. Null for anything else,
 * including playlists and channels, which can't be played as one video.
 */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined = null;
  if (host === "youtu.be") id = parts[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["shorts", "live", "embed", "v"].includes(parts[0])) id = parts[1];
  }
  return id && ID.test(id) ? id : null;
}

/** A thumbnail that exists for every video. */
export const youTubeThumbnail = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
