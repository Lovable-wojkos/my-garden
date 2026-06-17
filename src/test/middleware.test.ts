import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MiddlewareHandler } from "astro";
import { createClient } from "@/lib/supabase";
import { onRequest } from "@/middleware";

vi.mock("@/lib/supabase");

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/api/admin",
  "/api/weather",
  "/api/user-preferences",
  "/api/geocoding-suggestions",
  "/api/plantings",
] as const;

const MOCK_USER = { id: "user-123", email: "user@example.com" };

function makeContext(pathname: string) {
  const redirect = vi.fn().mockReturnValue(new Response(null, { status: 302 }));
  return {
    url: new URL(`http://localhost${pathname}`),
    request: new Request(`http://localhost${pathname}`),
    cookies: {},
    locals: {} as Record<string, unknown>,
    redirect,
    next: vi.fn().mockResolvedValue(new Response("next")),
  };
}

describe("middleware onRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each(PROTECTED_PREFIXES)("unauthenticated access to %s", (prefix) => {
    it("redirects to /auth/signin", async () => {
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      } as any);

      const context = makeContext(`${prefix}/nested`);
      const handler: MiddlewareHandler = onRequest;
      await handler(context, context.next);

      expect(context.redirect).toHaveBeenCalledWith("/auth/signin");
      expect(context.next).not.toHaveBeenCalled();
    });
  });

  describe.each(PROTECTED_PREFIXES)("authenticated access to %s", (prefix) => {
    it("calls next and sets locals.user", async () => {
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: MOCK_USER } }) },
      } as any);

      const context = makeContext(`${prefix}/nested`);
      const handler: MiddlewareHandler = onRequest;
      await handler(context, context.next);

      expect(context.next).toHaveBeenCalled();
      expect(context.redirect).not.toHaveBeenCalled();
      expect(context.locals.user).toEqual(MOCK_USER);
    });
  });

  it.each(["/", "/api/auth/signin", "/auth/signup"])(
    "allows unauthenticated access to public route %s",
    async (pathname) => {
      vi.mocked(createClient).mockReturnValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      } as any);

      const context = makeContext(pathname);
      const handler: MiddlewareHandler = onRequest;
      await handler(context, context.next);

      expect(context.next).toHaveBeenCalled();
      expect(context.redirect).not.toHaveBeenCalled();
    },
  );

  it("sets locals.user to null and still redirects when createClient returns null", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context = makeContext("/dashboard");
    const handler: MiddlewareHandler = onRequest;
    await handler(context, context.next);

    expect(context.locals.user).toBeNull();
    expect(context.redirect).toHaveBeenCalledWith("/auth/signin");
    expect(context.next).not.toHaveBeenCalled();
  });

  it("sets locals.user to null on public route when createClient returns null", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context = makeContext("/");
    const handler: MiddlewareHandler = onRequest;
    await handler(context, context.next);

    expect(context.locals.user).toBeNull();
    expect(context.next).toHaveBeenCalled();
    expect(context.redirect).not.toHaveBeenCalled();
  });
});
