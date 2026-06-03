import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";
import { onRequest } from "@/middleware";

vi.mock("@/lib/supabase");

describe("middleware onRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated user from /dashboard to /auth/signin", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);

    const redirect = vi.fn().mockReturnValue(new Response(null, { status: 302 }));
    const context = {
      url: new URL("http://localhost/dashboard"),
      request: new Request("http://localhost/dashboard"),
      cookies: {},
      locals: {} as Record<string, unknown>,
      redirect,
    };
    const next = vi.fn().mockResolvedValue(new Response("next"));

    await (onRequest as (ctx: typeof context, next: typeof next) => Promise<Response>)(context, next);

    expect(redirect).toHaveBeenCalledWith("/auth/signin");
    expect(next).not.toHaveBeenCalled();
  });
});
