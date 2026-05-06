import type { AppRole } from "@/hooks/useAuth";

export interface PermContext {
  roles: AppRole[];
  leaderMinistryIds: string[];
}

export function isGlobalManager(ctx: PermContext): boolean {
  return ctx.roles.includes("super_admin") || ctx.roles.includes("supervisor");
}

export function canManageMinistry(ctx: PermContext, ministryId: string | null | undefined): boolean {
  if (isGlobalManager(ctx)) return true;
  if (!ministryId) return false;
  return ctx.leaderMinistryIds.includes(ministryId);
}

export function canManageScheduleFor(ctx: PermContext, ministryId: string | null | undefined): boolean {
  return canManageMinistry(ctx, ministryId);
}

export function canApproveSubstitution(ctx: PermContext, ministryId: string | null | undefined): boolean {
  return canManageMinistry(ctx, ministryId);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  supervisor: "Supervisor",
  ministry_leader: "Líder de Ministério",
  volunteer: "Voluntário",
};

export const MINISTRY_ROLE_LABEL: Record<"leader" | "volunteer", string> = {
  leader: "Líder",
  volunteer: "Voluntário",
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
  culto: "Culto",
  ensaio: "Ensaio",
  evento_especial: "Evento Especial",
  reuniao: "Reunião",
};

export const CONFIRMATION_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Recusado",
  substitution_requested: "Pediu substituto",
};
