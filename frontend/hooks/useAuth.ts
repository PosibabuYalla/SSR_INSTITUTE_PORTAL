import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authService } from "@/services/auth.service";
import { useAuthStore } from "@/store/auth-store";
import { extractErrorMessage, isDefinitiveAuthFailure } from "@/lib/api-client";
import { LoginFormValues } from "@/schemas/auth.schema";
import { Role } from "@/types/auth";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

export function roleHomePath(role: Role): string {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "TRAINER") return "/trainer/dashboard";
  return "/student/dashboard";
}

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);

  return useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      const user = await authService.getMe();
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
    // Retry temporary failures (network, 5xx, cold start); a real 401 is handled by the
    // api-client interceptor, which refreshes or signs the user out.
    retry: (failureCount, error) => !isDefinitiveAuthFailure(error) && failureCount < 3,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginFormValues) => authService.login(input),
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken);
      // The login response is only { id, name, email, role, status } — no phone or profile. Don't
      // seed the /auth/me cache with it (it would be treated as fresh and the profile page would
      // show empty details); drop any cached user so the full record is fetched.
      queryClient.removeQueries({ queryKey: AUTH_QUERY_KEY });
      toast.success(`Welcome back, ${data.user.name.split(" ")[0]}!`, {
        description: "You're signed in. Taking you to your dashboard…",
      });
      router.push(roleHomePath(data.user.role));
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error));
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      toast.success("Logged out");
      router.push("/login");
    },
  });
}
