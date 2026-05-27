import { login } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return Response.json(
        { error: "Contraseña requerida" },
        { status: 400 }
      );
    }

    const success = await login(password);

    if (!success) {
      return Response.json(
        { error: "Contraseña incorrecta" },
        { status: 401 }
      );
    }

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
