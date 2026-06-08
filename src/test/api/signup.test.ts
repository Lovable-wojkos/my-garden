import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { createClient } from "@/lib/supabase";
import { POST } from "@/pages/api/auth/signup";

vi.mock("@/lib/supabase");

function makeContext(
  email = "user@example.com",
  password = "password",
): Pick<APIContext, "request" | "cookies" | "redirect"> {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", password);
  return {
    request: new Request("http://localhost/api/auth/signup", { method: "POST", body: formData }),
    cookies: { set: vi.fn() },
    redirect: vi
      .fn()
      .mockImplementation((url: string) => new Response(null, { status: 302, headers: { Location: url } })),
  };
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with error when Supabase is not configured", async () => {
    vi.mocked(createClient).mockReturnValue(null);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining("/auth/signup?error="));
  });

  it("redirects with encoded error message when signup fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({ error: { message: "Email already registered" } }),
      },
    } as any);

    const context = makeContext();
    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("Email already registered")),
    );
  });
});
