import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/signout";

vi.mock("@/lib/supabase");

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to / without throwing when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context: Pick<APIContext, 'request' | 'cookies' | 'redirect'> = {
      request: new Request("http://localhost/api/auth/signout", { method: "POST" }),
      cookies: { set: vi.fn() },
      redirect: vi
        .fn()
        .mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
    };

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/");
  });
});
