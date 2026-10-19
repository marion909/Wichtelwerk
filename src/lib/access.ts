import { redirect } from "next/navigation";
import type { Campaign, Organization, Role, User } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type SessionUser = User & { organization: Organization | null };

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({ where: { id }, include: { organization: true } });
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

export type OrgUser = SessionUser & { organizationId: string; organization: Organization };

/** Angemeldet und einer Firma zugeordnet (sonst Onboarding). */
export async function requireOrgUser(next?: string): Promise<OrgUser> {
  const user = await requireUser(next);
  if (!user.organizationId || !user.organization) redirect("/onboarding");
  return user as OrgUser;
}

export function isManager(role: Role): boolean {
  return role === "admin" || role === "location_admin";
}

/** Admin oder Standort-Admin. */
export async function requireManager(): Promise<OrgUser> {
  const user = await requireOrgUser("/admin");
  if (!isManager(user.role)) redirect("/app");
  return user;
}

/** Nur Firmen-Admins (Team, Branding, SSO …). */
export async function requireAdmin(): Promise<OrgUser> {
  const user = await requireOrgUser("/admin");
  if (user.role !== "admin") redirect(isManager(user.role) ? "/admin" : "/app");
  return user;
}

export function canManageCampaign(user: Pick<User, "role" | "organizationId" | "managedLocations">, campaign: Pick<Campaign, "organizationId" | "scopeLocation">): boolean {
  if (!user.organizationId || user.organizationId !== campaign.organizationId) return false;
  if (user.role === "admin") return true;
  if (user.role === "location_admin") {
    return Boolean(campaign.scopeLocation && user.managedLocations.includes(campaign.scopeLocation));
  }
  return false;
}

/** Filter für Aktionslisten: Standort-Admins sehen nur ihre Standorte. */
export function campaignScopeFilter(user: OrgUser) {
  if (user.role === "admin") return { organizationId: user.organizationId };
  return { organizationId: user.organizationId, scopeLocation: { in: user.managedLocations } };
}

/** Lädt eine Aktion, die der Nutzer verwalten darf – sonst 404-Weiterleitung. */
export async function requireManagedCampaign(id: string) {
  const user = await requireManager();
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || !canManageCampaign(user, campaign)) redirect("/admin");
  return { user, campaign };
}
