import { logout } from "@/lib/auth";

function shouldUseSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(":", "");

  return protocol === "https";
}

export async function POST(request: Request) {
  await logout(shouldUseSecureCookie(request));
  return Response.json({ success: true });
}
