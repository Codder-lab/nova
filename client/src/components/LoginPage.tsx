import React, { useState } from "react";
import {
  Bot,
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  X,
} from "lucide-react";
import { signIn, signUp } from "../lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LoginPageProps {
  onSuccess?: (user: any) => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSuccess,
  onClose,
  isModal = false,
}) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    if (mode === "signup" && !name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await signIn.email({
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMsg(
            res.error.message ||
              "Failed to sign in. Please verify your credentials.",
          );
        } else {
          setSuccessMsg("Welcome back! Authentication successful.");
          setTimeout(() => {
            onSuccess?.(res.data?.user);
          }, 400);
        }
      } else {
        const res = await signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMsg(res.error.message || "Failed to create account.");
        } else {
          setSuccessMsg("Account created successfully! Signing in...");
          setTimeout(() => {
            onSuccess?.(res.data?.user);
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail("alice@example.com");
    setPassword("securepassword123");
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn.email({
        email: "alice@example.com",
        password: "securepassword123",
      });

      if (res.error) {
        // If demo user wasn't registered yet, register it automatically
        const signupRes = await signUp.email({
          name: "Alice Developer",
          email: "alice@example.com",
          password: "securepassword123",
        });
        if (signupRes.error) {
          setErrorMsg(signupRes.error.message || "Demo login failed");
        } else {
          setSuccessMsg("Demo account initialized!");
          setTimeout(() => onSuccess?.(signupRes.data?.user), 400);
        }
      } else {
        setSuccessMsg("Logged in as demo user!");
        setTimeout(() => onSuccess?.(res.data?.user), 400);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Demo sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="w-full max-w-md mx-auto p-1">
      <Card className="relative overflow-hidden border border-border bg-card/95 backdrop-blur-md shadow-xl rounded-2xl p-6 sm:p-8">
        {/* Subtle decorative glowing background accent */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button if displayed as overlay */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header / Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-3 shadow-md">
            <Bot className="w-6 h-6" />
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Nova AI Assistant
            </h2>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Better Auth
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            {mode === "signin"
              ? "Sign in to access your autonomous agents, persistent sessions, and custom automations"
              : "Create your account to start running multi-turn AI agents with safety approval controls"}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex p-1 mb-5 rounded-lg bg-secondary/80 border border-border">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setErrorMsg(null);
            }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center",
              mode === "signin"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
            }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer text-center",
              mode === "signup"
                ? "bg-card text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Create Account
          </button>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2 animate-in fade-in-0 duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2 animate-in fade-in-0 duration-150">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-snug">{successMsg}</div>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-foreground">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. Alice Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="pl-9 h-9 text-xs bg-background"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="pl-9 h-9 text-xs bg-background"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                Password
              </label>
              {mode === "signup" && (
                <span className="text-[10px] text-muted-foreground">
                  Min 6 characters
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pl-9 pr-9 h-9 text-xs bg-background"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-9 text-xs font-semibold gap-1.5 mt-2 shadow-xs cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>
                  {mode === "signin" ? "Signing in..." : "Creating account..."}
                </span>
              </>
            ) : (
              <>
                <span>{mode === "signin" ? "Sign In" : "Create Account"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 text-muted-foreground font-semibold tracking-wider">
              Quick Options
            </span>
          </div>
        </div>

        {/* 1-Click Demo & Guest Actions */}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDemoLogin}
            disabled={loading}
            className="h-8 text-xs gap-1.5 border-dashed hover:bg-secondary font-medium cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>1-Click Demo Login (Alice)</span>
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Continue as Guest (cli-user)
            </Button>
          )}
        </div>

        {/* Footer info badge */}
        <div className="mt-5 pt-3 border-t border-border text-center flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Secured via Better Auth session tokens & MongoDB</span>
        </div>
      </Card>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in-0 duration-150">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center py-10 px-4">
      {content}
    </div>
  );
};

export default LoginPage;
