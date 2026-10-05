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
} from "@/services/integration.service";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Trash2,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

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

  useEffect(() => {
    if (connector) {
      setCredentials({});
      setTestResult(null);
      setErrorMessage(null);
    }
  }, [connector, existingIntegration]);

  if (!connector) return null;

  const handleFieldChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
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

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[540px] bg-card border-border"
    >
      <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Connect {connector.name}
                </DialogTitle>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {connector.category}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {connector.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {connector.documentationUrl && (
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 border border-border text-xs">
              <span className="text-muted-foreground">Need API credentials?</span>
              <a
                href={connector.documentationUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <span>Setup Guide</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-3">
            {connector.credentialFields.map((field) => {
              const currentValue = credentials[field.key] || "";
              const maskedPlaceholder =
                existingIntegration?.maskedCredentials?.[field.key];

              return (
                <div key={field.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">
                      {field.label}
                      {field.required && (
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

          {/* Test Status Banner */}
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
                  {testResult.success
                    ? "Connection Verified"
                    : "Connection Failed"}
                </span>
                <span className="text-[11px] opacity-90 break-all">
                  {testResult.message}
                </span>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 rounded-md text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full pt-2 border-t border-border">
          <div>
            {existingIntegration && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="h-8 gap-1.5 text-xs"
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={isTesting || isSaving}
              className="h-8 text-xs gap-1.5"
            >
              {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Test Connection</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || isTesting}
              className="h-8 text-xs gap-1.5"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save & Connect</span>
            </Button>
          </div>
        </DialogFooter>
    </Dialog>
  );
};
