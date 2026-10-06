import React, { useState, useEffect } from "react";
import type { ConnectorMeta, UserIntegration } from "@nova/shared";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  testIntegration,
  saveIntegration,
  deleteIntegration,
  fetchUserIntegrations,
  fetchGoogleAuthConfig,
  fetchGoogleAuthUrl,
} from "@/services/integration.service";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  Copy,
  Check,
} from "lucide-react";
import {
  BrandIcon,
  GoogleGLogo,
} from "@/components/icons/BrandLogos";

interface IntegrationConfigModalProps {
  connector: ConnectorMeta | null;
  existingIntegration?: UserIntegration | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: UserIntegration | null) => void;
}

export const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({
  connector,
  existingIntegration,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google OAuth State
  const isGoogle = connector?.id === "gmail" || connector?.id === "google_calendar";
  const [googleConfig, setGoogleConfig] = useState<{
    configured: boolean;
    clientId: string | null;
    redirectUri: string;
  } | null>(null);
  const [isGoogleOAuthLoading, setIsGoogleOAuthLoading] = useState(false);
  const [customGoogleClientId, setCustomGoogleClientId] = useState("");
  const [customGoogleClientSecret, setCustomGoogleClientSecret] = useState("");
  const [showManualFields, setShowManualFields] = useState(false);
  const [copiedUri, setCopiedUri] = useState(false);

  const handleCopyRedirectUri = () => {
    const uri =
      googleConfig?.redirectUri ||
      "http://localhost:5000/api/integrations/google/callback";
    navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  useEffect(() => {
    if (connector) {
      setCredentials({});
      setTestResult(null);
      setErrorMessage(null);
      setShowManualFields(!isGoogle);

      if (isGoogle) {
        fetchGoogleAuthConfig()
          .then((cfg) => setGoogleConfig(cfg))
          .catch((err) => console.error("Failed to load Google OAuth config:", err));
      }
    }
  }, [connector, existingIntegration, isGoogle]);

  // Listen for Google OAuth popup callback message
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        setIsGoogleOAuthLoading(false);
        setTestResult({
          success: true,
          message: event.data.email
            ? `Connected to Google account: ${event.data.email}`
            : "Google OAuth authorization successful!",
        });

        try {
          const userInts = await fetchUserIntegrations();
          const updated = userInts.find((i) => i.connectorId === connector?.id);
          onSuccess(updated || null);
          setTimeout(() => {
            onClose();
          }, 1200);
        } catch {
          onSuccess(null);
          onClose();
        }
      } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
        setIsGoogleOAuthLoading(false);
        setErrorMessage(
          event.data.message || "Google authentication failed or was cancelled."
        );
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [connector, onSuccess, onClose]);

  if (!connector) return null;

  const handleFieldChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
  };

  const handleStartGoogleOAuth = async () => {
    setIsGoogleOAuthLoading(true);
    setErrorMessage(null);
    setTestResult(null);

    try {
      const customCreds =
        customGoogleClientId && customGoogleClientSecret
          ? {
              clientId: customGoogleClientId.trim(),
              clientSecret: customGoogleClientSecret.trim(),
            }
          : undefined;

      const url = await fetchGoogleAuthUrl(connector.id, customCreds);

      // Open OAuth popup window centered on screen
      const width = 560;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        "google-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        setIsGoogleOAuthLoading(false);
        setErrorMessage("Popup blocked! Please allow popups for this site or authorize in a new tab.");
        window.location.href = url;
      }
    } catch (err: any) {
      setIsGoogleOAuthLoading(false);
      setErrorMessage(
        err.message || "Failed to initialize Google OAuth. Please check client credentials."
      );
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const res = await testIntegration({
        connectorId: connector.id,
        credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      });
      setTestResult({
        success: res.success,
        message: res.message || (res.success ? "Connection succeeded!" : "Connection failed"),
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Test request failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const saved = await saveIntegration({
        connectorId: connector.id,
        credentials,
        enabled: true,
        name: connector.name,
      });
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save integration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingIntegration) return;
    setIsDeleting(true);
    try {
      await deleteIntegration(connector.id);
      onSuccess(null);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete integration");
    } finally {
      setIsDeleting(false);
    }
  };

  const isConnected = existingIntegration?.status === "connected";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto bg-card border-border"
    >
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center shrink-0">
            <BrandIcon
              id={connector.id}
              name={connector.name}
              icon={connector.icon}
              className="w-10 h-10"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Connect {connector.name}
              </DialogTitle>
              <Badge variant="outline" className="capitalize text-[10px]">
                {connector.category}
              </Badge>
              {isConnected && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                  Connected
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              {connector.description}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* ONE-CLICK GOOGLE OAUTH CARD (For Gmail & Google Calendar) */}
        {isGoogle && (
          <div className="rounded-xl border border-border/80 bg-gradient-to-b from-muted/50 to-muted/20 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center shadow-2xs shrink-0">
                  <GoogleGLogo className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    Google OAuth 2.0
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Authorize securely with your Google Workspace account.
                  </p>
                </div>
              </div>

              {googleConfig?.configured ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                  OAuth Ready
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  Manual Setup
                </Badge>
              )}
            </div>

            {/* Main Google Sign-in Button */}
            {googleConfig?.configured ? (
              <div className="pt-1">
                <Button
                  onClick={handleStartGoogleOAuth}
                  disabled={isGoogleOAuthLoading}
                  className="w-full h-10 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 dark:border-zinc-700 font-semibold shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isGoogleOAuthLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-700" />
                      <span>Opening Google Authentication...</span>
                    </>
                  ) : (
                    <>
                      <GoogleGLogo className="w-4 h-4 shrink-0" />
                      <span>Sign in with Google</span>
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Nova requests permissions for{" "}
                  <span className="font-semibold text-foreground">
                    {connector.id === "gmail" ? "Gmail inbox & send" : "Google Calendar events"}
                  </span>
                  . You can revoke access at any time in your Google Account.
                </p>

                {/* Redirect URI Box */}
                <div className="mt-3 pt-3 border-t border-border/60 text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-medium text-foreground">Authorized Redirect URI:</span>
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                    >
                      {copiedUri ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span className="text-emerald-500 font-semibold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy URI</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-2 rounded bg-background/80 border border-border font-mono text-[11px] text-foreground select-all break-all">
                    {googleConfig?.redirectUri || "http://localhost:5000/api/integrations/google/callback"}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    ⚠️ If you see <strong className="text-amber-500">Error 400: redirect_uri_mismatch</strong>, add this exact URI in your Google Cloud Console under <em>"Authorized redirect URIs"</em> and click <strong>SAVE</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">Setup Google Cloud Credentials</p>
                    <p className="text-[11px] opacity-90 leading-relaxed">
                      Add <code className="px-1 py-0.5 bg-black/20 rounded font-mono">GOOGLE_CLIENT_ID</code> and{" "}
                      <code className="px-1 py-0.5 bg-black/20 rounded font-mono">GOOGLE_CLIENT_SECRET</code> to your{" "}
                      <code className="px-1 py-0.5 bg-black/20 rounded font-mono">server/.env</code> file, or enter them below to authenticate immediately:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Client ID
                    </label>
                    <Input
                      placeholder="...apps.googleusercontent.com"
                      value={customGoogleClientId}
                      onChange={(e) => setCustomGoogleClientId(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Client Secret
                    </label>
                    <Input
                      type="password"
                      placeholder="GOCSPX-..."
                      value={customGoogleClientSecret}
                      onChange={(e) => setCustomGoogleClientSecret(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleStartGoogleOAuth}
                  disabled={isGoogleOAuthLoading || !customGoogleClientId.trim()}
                  className="w-full h-9 bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isGoogleOAuthLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GoogleGLogo className="w-3.5 h-3.5" />
                  )}
                  <span>Authorize with Google</span>
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Setup Documentation Link */}
        {connector.documentationUrl && (
          <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 border border-border text-xs">
            <span className="text-muted-foreground">Need help or developer guide?</span>
            <a
              href={connector.documentationUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-primary hover:underline font-medium"
            >
              <span>Google API Docs</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Toggle Manual / Developer Token Fields (For Google) */}
        {isGoogle && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowManualFields(!showManualFields)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {showManualFields ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>Or enter manual OAuth access token / developer fields</span>
            </button>
          </div>
        )}

        {/* Manual Form Fields */}
        {showManualFields && (
          <div className="space-y-3 pt-1 border-t border-border/60">
            {connector.credentialFields.map((field) => {
              const currentValue = credentials[field.key] || "";
              const maskedPlaceholder =
                existingIntegration?.maskedCredentials?.[field.key];

              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      {field.label}
                      {field.required && !isGoogle && (
                        <span className="text-rose-500 ml-1">*</span>
                      )}
                    </label>
                    {maskedPlaceholder && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        Current: {maskedPlaceholder}
                      </span>
                    )}
                  </div>
                  <Input
                    type={field.type === "password" ? "password" : "text"}
                    placeholder={
                      maskedPlaceholder
                        ? "Enter new value to update..."
                        : field.placeholder || ""
                    }
                    value={currentValue}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                  {field.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {field.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Test / Success Status Banner */}
        {testResult && (
          <div
            className={`p-3 rounded-md text-xs flex items-start gap-2 border ${
              testResult.success
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold block">
                {testResult.success ? "Connection Verified" : "Connection Failed"}
              </span>
              <span className="text-[11px] opacity-90 break-all">
                {testResult.message}
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-2.5 rounded-md text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-3 border-t border-border">
        <div>
          {existingIntegration && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              className="h-8 gap-1.5 text-xs cursor-pointer"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>Disconnect</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(!isGoogle || showManualFields) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={isTesting || isSaving}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Test Connection</span>
              </Button>

              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || isTesting}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save & Connect</span>
              </Button>
            </>
          )}

          {isGoogle && !showManualFields && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 text-xs cursor-pointer"
            >
              Close
            </Button>
          )}
        </div>
      </DialogFooter>
    </Dialog>
  );
};
