import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase";
import { handleAuthCallback } from "@/lib/auth/callback";

vi.mock("@/lib/supabase");

function makeCookies() {
  return { set: vi.fn() };
}

describe("handleAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to signin with error when no code or token_hash", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {},
    } as any);

    const result = await handleAuthCallback(new URLSearchParams(), new Headers(), makeCookies() as any);

    expect(result.redirect).toContain("/auth/signin?error=");
    expect(result.redirect).toContain(encodeURIComponent("Invalid authentication link"));
  });

  it("redirects to signin when PKCE exchange fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Invalid code" } }),
      },
    } as any);

    const params = new URLSearchParams({ code: "abc123" });
    const result = await handleAuthCallback(params, new Headers(), makeCookies() as any);

    expect(result.redirect).toContain(encodeURIComponent("Invalid code"));
  });

  it("redirects to dashboard on successful PKCE exchange", async () => {
    const cookies = makeCookies();
    vi.mocked(createClient).mockImplementation((_headers, cookiesArg) => {
      return {
        auth: {
          exchangeCodeForSession: vi.fn().mockImplementation(() => {
            cookiesArg.set("sb-access-token", "mock-token", { path: "/" });
            return Promise.resolve({ error: null });
          }),
        },
      } as any;
    });

    const params = new URLSearchParams({ code: "abc123" });
    const result = await handleAuthCallback(params, new Headers(), cookies as any);

    expect(result.redirect).toBe("/dashboard");
    expect(cookies.set).toHaveBeenCalledWith("sb-access-token", "mock-token", { path: "/" });
  });

  it("redirects to signin when verifyOtp fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        verifyOtp: vi.fn().mockResolvedValue({ error: { message: "Token expired" } }),
      },
    } as any);

    const params = new URLSearchParams({ token_hash: "hash123", type: "magiclink" });
    const result = await handleAuthCallback(params, new Headers(), makeCookies() as any);

    expect(result.redirect).toContain(encodeURIComponent("Token expired"));
  });

  it("redirects to dashboard on successful verifyOtp", async () => {
    const cookies = makeCookies();
    vi.mocked(createClient).mockImplementation((_headers, cookiesArg) => {
      return {
        auth: {
          verifyOtp: vi.fn().mockImplementation(() => {
            cookiesArg.set("sb-access-token", "mock-token", { path: "/" });
            return Promise.resolve({ error: null });
          }),
        },
      } as any;
    });

    const params = new URLSearchParams({ token_hash: "hash123", type: "magiclink" });
    const result = await handleAuthCallback(params, new Headers(), cookies as any);

    expect(result.redirect).toBe("/dashboard");
    expect(cookies.set).toHaveBeenCalledWith("sb-access-token", "mock-token", { path: "/" });
  });
});
