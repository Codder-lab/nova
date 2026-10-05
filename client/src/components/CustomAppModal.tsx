import React, { useState } from "react";
import type {
  CustomActionDefinition,
  CustomAppConfig,
  UserIntegration,
} from "@nova/shared";
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
  saveIntegration,
  testIntegration,
} from "@/services/integration.service";
import {
  Globe,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Code2,
} from "lucide-react";

interface CustomAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: UserIntegration) => void;
}

export const CustomAppModal: React.FC<CustomAppModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [appName, setAppName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authHeaderKey, setAuthHeaderKey] = useState("Authorization");
  const [authPrefix, setAuthPrefix] = useState("Bearer ");
  const [apiKey, setApiKey] = useState("");

  const [actions, setActions] = useState<CustomActionDefinition[]>([
    {
      name: "custom_fetch_data",
      description: "Query resources from the custom API",
      method: "GET",
      path: "/items",
      riskLevel: "low",
      parameters: [
        {
          name: "query",
          type: "string",
          required: false,
          description: "Search or filter keyword",
        },
      ],
    },
  ]);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addAction = () => {
    setActions((prev) => [
      ...prev,
      {
        name: `custom_action_${prev.length + 1}`,
        description: "Perform action on custom API",
        method: "POST",
        path: "/action",
        riskLevel: "medium",
        parameters: [],
      },
    ]);
  };

  const removeAction = (idx: number) => {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAction = (idx: number, updates: Partial<CustomActionDefinition>) => {
    setActions((prev) =>
      prev.map((act, i) => (i === idx ? { ...act, ...updates } : act))
    );
  };

  const addParameter = (actionIdx: number) => {
    setActions((prev) =>
      prev.map((act, i) => {
        if (i !== actionIdx) return act;
        return {
          ...act,
          parameters: [
            ...act.parameters,
            {
              name: `param_${act.parameters.length + 1}`,
              type: "string",
              required: true,
              description: "Parameter description",
            },
          ],
        };
      })
    );
  };

  const removeParameter = (actionIdx: number, paramIdx: number) => {
    setActions((prev) =>
      prev.map((act, i) => {
        if (i !== actionIdx) return act;
        return {
          ...act,
          parameters: act.parameters.filter((_, pi) => pi !== paramIdx),
        };
      })
    );
  };

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      setErrorMessage("Base URL is required to test connection");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setErrorMessage(null);
    try {
      const customConfig: CustomAppConfig = {
        baseUrl: baseUrl.trim(),
        authHeaderKey,
        authPrefix,
        actions,
      };
      const res = await testIntegration({
        connectorId: "custom_rest",
        credentials: { apiKey },
        customConfig,
      });
      setTestResult({
        success: res.success,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Failed to reach endpoint",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!appName.trim() || !baseUrl.trim()) {
      setErrorMessage("App name and Base URL are required");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const customConfig: CustomAppConfig = {
        baseUrl: baseUrl.trim(),
        authHeaderKey: authHeaderKey.trim() || undefined,
        authPrefix,
        actions,
      };

      const connectorId = `custom_${appName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")}`;

      const saved = await saveIntegration({
        connectorId,
        name: appName.trim(),
        credentials: { apiKey },
        enabled: true,
        customConfig,
      });

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save custom integration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto bg-card border-border"
    >
      <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Build Custom App Integration
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-500">
                  Dynamic Tools
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Connect any REST API or Webhook service. Nova synthesizes active tools for the AI agent automatically.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* General App Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                App Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g., Linear, Jira, Acme CRM"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Base URL <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="https://api.example.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Auth Header
              </label>
              <Input
                placeholder="Authorization"
                value={authHeaderKey}
                onChange={(e) => setAuthHeaderKey(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Prefix
              </label>
              <Input
                placeholder="Bearer "
                value={authPrefix}
                onChange={(e) => setAuthPrefix(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                API Key / Token
              </label>
              <Input
                type="password"
                placeholder="Secret key or token"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Action Tools Builder */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-primary" />
                  Agent Tools & Endpoints ({actions.length})
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Each action becomes a callable tool for Nova.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={addAction}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Endpoint</span>
              </Button>
            </div>

            <div className="space-y-3">
              {actions.map((act, actIdx) => (
                <div
                  key={actIdx}
                  className="p-3 rounded-lg border border-border bg-card/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={act.method}
                        onChange={(e) =>
                          updateAction(actIdx, {
                            method: e.target.value as any,
                          })
                        }
                        className="h-7 px-2 text-xs font-bold rounded border border-border bg-background"
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                      </select>
                      <Input
                        placeholder="/endpoint/path"
                        value={act.path}
                        onChange={(e) =>
                          updateAction(actIdx, { path: e.target.value })
                        }
                        className="h-7 text-xs flex-1 bg-background font-mono"
                      />
                    </div>
                    {actions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAction(actIdx)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      placeholder="Tool Name (e.g. create_lead)"
                      value={act.name}
                      onChange={(e) =>
                        updateAction(actIdx, { name: e.target.value })
                      }
                      className="h-7 text-xs bg-background font-mono"
                    />
                    <select
                      value={act.riskLevel}
                      onChange={(e) =>
                        updateAction(actIdx, {
                          riskLevel: e.target.value as any,
                        })
                      }
                      className="h-7 px-2 text-xs rounded border border-border bg-background"
                    >
                      <option value="low">Risk Level: Low (Auto)</option>
                      <option value="medium">Risk Level: Medium</option>
                      <option value="high">Risk Level: High (Requires Approval)</option>
                    </select>
                  </div>

                  <Input
                    placeholder="Description (tells the AI what this tool does)"
                    value={act.description}
                    onChange={(e) =>
                      updateAction(actIdx, { description: e.target.value })
                    }
                    className="h-7 text-xs bg-background"
                  />

                  {/* Parameters */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Parameters ({act.parameters.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => addParameter(actIdx)}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        + Add Param
                      </button>
                    </div>

                    {act.parameters.map((param, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-center gap-2 text-xs bg-muted/40 p-1.5 rounded"
                      >
                        <Input
                          placeholder="name"
                          value={param.name}
                          onChange={(e) => {
                            const newParams = [...act.parameters];
                            newParams[pIdx].name = e.target.value;
                            updateAction(actIdx, { parameters: newParams });
                          }}
                          className="h-6 text-[11px] flex-1 bg-background font-mono"
                        />
                        <select
                          value={param.type}
                          onChange={(e) => {
                            const newParams = [...act.parameters];
                            newParams[pIdx].type = e.target.value as any;
                            updateAction(actIdx, { parameters: newParams });
                          }}
                          className="h-6 text-[11px] rounded border border-border bg-background"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                        </select>
                        <Input
                          placeholder="description"
                          value={param.description}
                          onChange={(e) => {
                            const newParams = [...act.parameters];
                            newParams[pIdx].description = e.target.value;
                            updateAction(actIdx, { parameters: newParams });
                          }}
                          className="h-6 text-[11px] flex-1 bg-background"
                        />
                        <button
                          type="button"
                          onClick={() => removeParameter(actIdx, pIdx)}
                          className="text-muted-foreground hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                  {testResult.success ? "Endpoint Reached" : "Connection Error"}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={isTesting || isSaving}
            className="h-8 text-xs gap-1.5"
          >
            {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Test Endpoint</span>
          </Button>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isTesting}
            className="h-8 text-xs gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save Custom App</span>
          </Button>
        </DialogFooter>
    </Dialog>
  );
};
