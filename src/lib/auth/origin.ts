import * as serverEnv from "astro:env/server";

export function resolveAppOrigin(requestUrl: string): string {
  const siteUrl = serverEnv.SITE_URL;
  if (siteUrl) {
    return siteUrl.replace(/\/$/, "");
  }
  return new URL(requestUrl).origin;
}

export function isSameOriginRequest(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expectedOrigin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin;
    } catch {
      return false;
    }
  }

  return false;
}
