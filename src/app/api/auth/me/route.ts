import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  return Response.json({ authenticated: true });
}
