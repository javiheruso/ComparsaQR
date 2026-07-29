import type { PermisoPunto, SessionData } from "@/lib/auth";

export type ActorType = "admin" | "scanner" | "punto" | "anonymous";

export interface ActorContext {
  actorType: ActorType;
  actorId: string | null;
  authenticated: boolean;
  puntoPermiso: PermisoPunto | null;
}

export interface AccessRequirement {
  allowRoles: Array<Exclude<ActorType, "anonymous">>;
  allowedPuntoPermissions?: PermisoPunto[];
  unauthenticatedMessage: string;
  forbiddenMessage: string;
}

export type AccessDecision =
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string };

export function getActorContext(session: Partial<SessionData> | null | undefined): ActorContext {
  if (!session) {
    return {
      actorType: "anonymous",
      actorId: null,
      authenticated: false,
      puntoPermiso: null,
    };
  }

  const actorType = resolveActorType(session);

  return {
    actorType,
    actorId: session.actorId ?? legacyActorId(session, actorType),
    authenticated: actorType !== "anonymous",
    puntoPermiso: session.puntoPermiso ?? null,
  };
}

export function requireAccess(
  session: Partial<SessionData> | null | undefined,
  requirement: AccessRequirement,
): AccessDecision {
  const actor = getActorContext(session);

  if (!actor.authenticated) {
    return { ok: false, status: 401, message: requirement.unauthenticatedMessage };
  }

  if (!requirement.allowRoles.includes(actor.actorType as Exclude<ActorType, "anonymous">)) {
    return { ok: false, status: 403, message: requirement.forbiddenMessage };
  }

  if (
    actor.actorType === "punto" &&
    requirement.allowedPuntoPermissions &&
    !requirement.allowedPuntoPermissions.includes(actor.puntoPermiso as PermisoPunto)
  ) {
    return { ok: false, status: 403, message: requirement.forbiddenMessage };
  }

  return { ok: true };
}

export function canAccessAdmin(session: Partial<SessionData> | null | undefined): boolean {
  return getActorContext(session).actorType === "admin";
}

export function canAccessScanner(session: Partial<SessionData> | null | undefined): boolean {
  const actorType = getActorContext(session).actorType;
  return actorType === "admin" || actorType === "scanner" || actorType === "punto";
}

function resolveActorType(session: Partial<SessionData>): ActorType {
  if (session.actorType === "admin" || session.actorType === "scanner" || session.actorType === "punto") {
    return session.actorType;
  }

  if (session.isLoggedIn) {
    return "admin";
  }

  if (session.scannerVerified && session.puntoVentaId) {
    return "punto";
  }

  if (session.scannerVerified) {
    return "scanner";
  }

  return "anonymous";
}

function legacyActorId(session: Partial<SessionData>, actorType: ActorType): string | null {
  if (actorType === "admin") return "admin";
  if (actorType === "scanner") return "scanner";
  if (actorType === "punto" && session.puntoVentaId) return `punto:${session.puntoVentaId}`;
  return null;
}
