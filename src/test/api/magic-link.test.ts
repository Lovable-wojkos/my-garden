import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { pl } from "@/lib/copy/pl";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/magic-link";

const envState = vi.hoisted(() => ({ siteUrl: "http://localhost:4321" }));

vi.mock("astro:env/server", () => ({
  get SITE_URL() {
    return envState.siteUrl;
  },
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "test-anon-key-do-not-use-in-production",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-do-not-use-in-production",
  CRON_SECRET: "test-cron-secret-do-not-use-in-production",
}));

vi.mock("@/lib/supabase");

vi.mock("@/lib/auth/origin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/origin")>();
  return {
    ...actual,
    isSameOriginRequest: vi.fn(actual.isSameOriginRequest),
  };
});

function makeContext(
  email = "user@example.com",
  origin = "http://localhost:4321",
): Pick<APIContext, "request" | "cookies" | "redirect"> {
  const formData = new FormData();
  formData.set("email", email);
  return {
    request: new Request(`${origin}/api/auth/magic-link`, {
      method: "POST",
      body: formData,
      headers: { Origin: origin },
    }),
    cookies: { set: vi.fn() },
    redirect: vi
      .fn()
      .mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
  };
}

describe("POST /api/auth/magic-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.siteUrl = "http://localhost:4321";
    vi.mocked(isSameOriginRequest).mockReturnValue(true);
  });

  it("redirects with error when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(pl.auth.errors.notConfigured)),
    );
  });

  it("redirects with encoded error message when OTP send fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: { message: "Rate limit exceeded" } }),
      },
    } as any);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(pl.auth.errors.sendFailed)),
    );
  });

  it("rejects cross-origin POST without matching Origin or Referer", async () => {
    vi.mocked(isSameOriginRequest).mockReturnValue(false);
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp: vi.fn() },
    } as any);

    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(pl.auth.errors.sendFailed)),
    );
  });

  it("redirects with validation error when email is invalid", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp: vi.fn() },
    } as any);

    const context = makeContext("not-an-email");
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent(pl.auth.errors.emailInvalid)),
    );
  });

  it("redirects to /auth/check-email on successful OTP send", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      },
    } as any);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/auth\/check-email/));
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

  it("prefers SITE_URL over request origin for emailRedirectTo", async () => {
    const prodOrigin = "https://my-garden.vercel.app";
    envState.siteUrl = prodOrigin;
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp },
    } as any);

    const formData = new FormData();
    formData.set("email", "user@example.com");
    const context = {
      request: new Request("http://localhost:4321/api/auth/magic-link", {
        method: "POST",
        body: formData,
        headers: { Origin: prodOrigin },
      }),
      cookies: { set: vi.fn() },
      redirect: vi
        .fn()
        .mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
    };

    await POST(context);

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://my-garden.vercel.app/auth/callback",
        shouldCreateUser: true,
      },
    });
  });

  it("falls back to request origin when SITE_URL is unset", async () => {
    envState.siteUrl = "";
    const signInWithOtp = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createClient).mockReturnValue({
      auth: { signInWithOtp },
    } as any);

    const context = makeContext("user@example.com", "http://preview.local:4321");
    await POST(context);

    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "http://preview.local:4321/auth/callback",
        shouldCreateUser: true,
      },
    });
  });
});
