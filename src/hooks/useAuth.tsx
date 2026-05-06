import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Profile {
  id: string;
  church_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
}

export interface ChurchInfo {
  id: string;
  name: string;
  city: string | null;
  timezone: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  church: ChurchInfo | null;
  roles: AppRole[];
  leaderMinistryIds: string[];
  loading: boolean;
  hasRole: (r: AppRole) => boolean;
  hasAnyRole: (rs: AppRole[]) => boolean;
  isGlobalManager: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [church, setChurch] = useState<ChurchInfo | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [leaderMinistryIds, setLeaderMinistryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, church_id, full_name, email, phone, avatar_url")
        .eq("id", userId)
        .maybeSingle();

      setProfile(prof ?? null);

      if (prof?.church_id) {
        const [{ data: ch }, { data: rs }, { data: vols }] = await Promise.all([
          supabase.from("churches").select("id, name, city, timezone").eq("id", prof.church_id).maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", userId),
          supabase
            .from("volunteers")
            .select("id, volunteer_ministries(ministry_id, role)")
            .eq("user_id", userId)
            .eq("church_id", prof.church_id),
        ]);

        setChurch(ch ?? null);
        setRoles((rs ?? []).map((r) => r.role as AppRole));

        const leaderIds = new Set<string>();
        (vols ?? []).forEach((v: any) => {
          (v.volunteer_ministries ?? []).forEach((vm: any) => {
            if (vm.role === "leader") leaderIds.add(vm.ministry_id);
          });
        });
        setLeaderMinistryIds(Array.from(leaderIds));
      } else {
        setChurch(null);
        setRoles([]);
        setLeaderMinistryIds([]);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setTimeout(() => {
          loadProfile(newSession.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setChurch(null);
        setRoles([]);
        setLeaderMinistryIds([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        loadProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const currentRoles = roles;
  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    church,
    roles,
    leaderMinistryIds,
    loading,
    hasRole: (r) => currentRoles.includes(r),
    hasAnyRole: (rs) => rs.some((r) => currentRoles.includes(r)),
    isGlobalManager: currentRoles.includes("super_admin") || currentRoles.includes("supervisor"),
    signOut: async () => { await supabase.auth.signOut(); },
    refresh: async () => {
      if (session?.user) await loadProfile(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
