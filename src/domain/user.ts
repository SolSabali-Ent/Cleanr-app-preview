/**
 * Shared user domain. No UI.
 * Roles don't change the system; they change the lens.
 */

export type UserRole = "customer" | "provider";

export interface User {
  id: string;
  email?: string;
  role: UserRole;
  // extend as needed
}

export function isProvider(user: User): boolean {
  return user.role === "provider";
}

export function isCustomer(user: User): boolean {
  return user.role === "customer";
}
