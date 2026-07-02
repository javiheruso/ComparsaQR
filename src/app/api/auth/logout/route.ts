import { logout } from "@/lib/auth";
import { apiSuccess } from "@/lib/api-error";

function shouldUseSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(":", "");

  return protocol === "https";
}

export async function POST(request: Request) {
  await logout(shouldUseSecureCookie(request));
  return apiSuccess({ success: true });
}
