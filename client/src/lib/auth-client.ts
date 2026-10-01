import { createAuthClient } from "better-auth/react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface AuthSession {
  id: string;
  userId: string;
  expiresAt: Date | string;
  token: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SessionData {
  user: AuthUser;
  session: AuthSession;
}

export const authClient = createAuthClient({
  baseURL: window.location.origin,
});

export const { signIn, signUp, getSession } = authClient;

// Wrap signOut so options are optional (defaults to empty object)
export const signOut = (
  options?: Parameters<typeof authClient.signOut>[0],
  fetchOptions?: Parameters<typeof authClient.signOut>[1]
) => authClient.signOut(options ?? {}, fetchOptions);

// Typed useSession hook to prevent conditional type degradation to 'never'
export const useSession: () => {
  data: SessionData | null;
  isPending: boolean;
  isRefetching: boolean;
  error: any;
  refetch: () => Promise<void>;
} = authClient.useSession as any;
