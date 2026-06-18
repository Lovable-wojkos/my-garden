import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/magic-link";

vi.mock("@/lib/supabase");

function makeContext(
  email = "user@example.com",
  origin = "http://localhost:4321",
): Pick<APIContext, "request" | "cookies" | "redirect"> {
  const formData = new FormData();
  formData.set("email", email);
  return {
    request: new Request(`${origin}/api/auth/magic-link`, { method: "POST", body: formData }),
    cookies: { set: vi.fn() },
    redirect: vi
      .fn()
      .mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
  };
}

describe("POST /api/auth/magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with error when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining("/auth/signin?error="));
  });

  it("redirects with encoded error message when OTP send fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: { message: "Rate limit exceeded" } }),
      },
    } as any);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("Rate limit exceeded")));
  });

  it("redirects to /auth/check-email on successful OTP send", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/auth/check-email");
  });

  it("passes emailRedirectTo with request origin and shouldCreateUser", async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp },
    } as any);

    const context = makeContext("user@example.com", "http://localhost:4321");
    await POST(context);

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "http://localhost:4321/auth/callback",
        shouldCreateUser: true,
      },
    });
  });
});
