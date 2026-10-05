import React, { useState, useEffect } from "react";
import type { ConnectorMeta, UserIntegration } from "@nova/shared";
import {
  fetchConnectors,
  fetchUserIntegrations,
  toggleIntegration,
  testIntegration,
} from "@/services/integration.service";
import { IntegrationConfigModal } from "./IntegrationConfigModal";
import { CustomAppModal } from "./CustomAppModal";
import { WhatsAppModal } from "./WhatsAppModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plug,
  ShieldCheck,
  Globe,
  Radio,
  BookOpen,
  MessageSquare,
  Sparkles,
  Settings2,
  Send,
  Phone,
} from "lucide-react";

export const IntegrationsView: React.FC = () => {
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([]);
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Modals state
  const [selectedConnector, setSelectedConnector] = useState<ConnectorMeta | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);

  // Testing status map per connectorId
  const [testingMap, setTestingMap] = useState<Record<string, boolean>>({});
  const [testResultMap, setTestResultMap] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [allConnectors, activeUserIntegrations] = await Promise.all([
        fetchConnectors(),
        fetchUserIntegrations(),
      ]);
      setConnectors(allConnectors);
      setUserIntegrations(activeUserIntegrations);
    } catch (err) {
      console.error("Failed to load integrations data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggle = async (connectorId: string, currentEnabled: boolean) => {
    try {
      const updated = await toggleIntegration(connectorId, !currentEnabled);
      setUserIntegrations((prev) =>
        prev.map((i) => (i.connectorId === connectorId ? updated : i))
      );
    } catch (err) {
      console.error("Failed to toggle integration:", err);
    }
  };

  const handleTestCard = async (connectorId: string) => {
    setTestingMap((prev) => ({ ...prev, [connectorId]: true }));
    try {
      const res = await testIntegration({ connectorId });
      setTestResultMap((prev) => ({
        ...prev,
        [connectorId]: {
          success: res.success,
          message: res.message,
        },
      }));
      // Refresh status in state
      loadData();
    } catch (err: any) {
      setTestResultMap((prev) => ({
        ...prev,
        [connectorId]: {
          success: false,
          message: err.message || "Test failed",
        },
      }));
    } finally {
      setTestingMap((prev) => ({ ...prev, [connectorId]: false }));
    }
  };

  // Find user integration for a connector
  const getUserIntegration = (connectorId: string) =>
    userIntegrations.find((i) => i.connectorId === connectorId);

  // Filter connectors
  const filteredConnectors = connectors.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.capabilities?.some((cap) =>
        cap.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      selectedCategory === "all" || c.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Also include user's custom integrations in the list
  const customUserIntegrations = userIntegrations.filter((ui) =>
    ui.connectorId.startsWith("custom_") && ui.connectorId !== "custom_rest"
  );

  const connectedCount = userIntegrations.filter((i) => i.status === "connected").length;

  const getConnectorIcon = (iconName: string) => {
    switch (iconName) {
      case "Github":
        return <Globe className="w-5 h-5 text-indigo-400" />;
      case "MessageSquare":
      case "Slack":
        return <MessageSquare className="w-5 h-5 text-amber-400" />;
      case "Radio":
      case "Discord":
        return <Radio className="w-5 h-5 text-purple-400" />;
      case "BookOpen":
      case "Notion":
        return <BookOpen className="w-5 h-5 text-emerald-400" />;
      case "Send":
      case "Telegram":
        return <Send className="w-5 h-5 text-sky-400" />;
      case "Phone":
      case "WhatsApp":
      case "whatsapp":
        return <Phone className="w-5 h-5 text-emerald-400" />;
      default:
        return <Globe className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Connected Apps</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                {connectedCount}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Plug className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">SaaS Connectors</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                {connectors.length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Custom REST APIs</p>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
                {customUserIntegrations.length}
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
              <Globe className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Vault Security</p>
              <h3 className="text-sm font-semibold tracking-tight text-foreground mt-1 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                AES-256-GCM
              </h3>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar: Filters, Search & Add Custom Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "all", label: "All Connectors" },
            { id: "developer", label: "Developer" },
            { id: "communication", label: "Communication" },
            { id: "productivity", label: "Productivity" },
            { id: "custom", label: "Custom APIs" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Custom App Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search apps & tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-card"
            />
          </div>

          <Button
            size="sm"
            onClick={() => setCustomModalOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom App</span>
          </Button>
        </div>
      </div>

      {/* Connectors Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs">Loading connectors & active services...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConnectors.map((connector) => {
            const userInt = getUserIntegration(connector.id);
            const isConnected = userInt?.status === "connected";
            const isError = userInt?.status === "error";
            const isTesting = testingMap[connector.id];
            const testResult = testResultMap[connector.id];

            return (
              <Card
                key={connector.id}
                className="bg-card border-border shadow-xs hover:border-border/80 transition-all flex flex-col justify-between"
              >
                <CardContent className="p-4 space-y-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-secondary/80 border border-border flex items-center justify-center">
                        {getConnectorIcon(connector.icon)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-foreground">
                            {connector.name}
                          </h4>
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 h-3.5 uppercase font-medium"
                          >
                            {connector.category}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {connector.authType.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isConnected ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 px-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected
                      </Badge>
                    ) : isError ? (
                      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] gap-1 px-1.5 py-0.5">
                        <AlertCircle className="w-3 h-3" />
                        Error
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-muted-foreground px-1.5 py-0.5"
                      >
                        Not Connected
                      </Badge>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {connector.description}
                  </p>

                  {/* Capabilities Chips */}
                  {connector.capabilities && connector.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {connector.capabilities.slice(0, 3).map((cap, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px] font-medium"
                        >
                          {cap}
                        </span>
                      ))}
                      {connector.capabilities.length > 3 && (
                        <span className="text-[10px] text-muted-foreground/80 self-center">
                          +{connector.capabilities.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Masked Credentials Preview (if configured) */}
                  {userInt && Object.keys(userInt.maskedCredentials || {}).length > 0 && (
                    <div className="px-2.5 py-1.5 rounded bg-muted/40 border border-border/60 text-[11px] flex items-center justify-between">
                      <span className="text-muted-foreground truncate max-w-[140px]">
                        {Object.values(userInt.maskedCredentials)[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Encrypted
                      </span>
                    </div>
                  )}

                  {/* Inline Test Result Message */}
                  {testResult && (
                    <div
                      className={`text-[11px] p-2 rounded flex items-center gap-1.5 ${
                        testResult.success
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {testResult.success ? (
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{testResult.message}</span>
                    </div>
                  )}
                </CardContent>

                {/* Card Footer Actions */}
                <div className="p-3 px-4 bg-muted/20 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {userInt && (
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={userInt.enabled}
                          onCheckedChange={() =>
                            handleToggle(connector.id, userInt.enabled)
                          }
                          className="scale-75"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {userInt.enabled ? "Active" : "Paused"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {userInt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTestCard(connector.id)}
                        disabled={isTesting}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {isTesting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                    )}

                    <Button
                      variant={isConnected ? "outline" : "default"}
                      size="sm"
                      onClick={() => {
                        if (connector.id === "whatsapp") {
                          setWhatsappModalOpen(true);
                        } else if (connector.id === "custom_rest") {
                          setCustomModalOpen(true);
                        } else {
                          setSelectedConnector(connector);
                          setConfigModalOpen(true);
                        }
                      }}
                      className="h-7 px-2.5 text-xs font-semibold gap-1 cursor-pointer"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{isConnected ? "Configure" : "Connect"}</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Built-in Connector Setup Modal */}
      {selectedConnector && (
        <IntegrationConfigModal
          connector={selectedConnector}
          existingIntegration={getUserIntegration(selectedConnector.id)}
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedConnector(null);
          }}
          onSuccess={() => loadData()}
        />
      )}

      {/* Universal Custom App Builder Modal */}
      <CustomAppModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        onSuccess={() => loadData()}
      />

      {/* WhatsApp Multi-Device & Two-Way Assistant Modal */}
      <WhatsAppModal
        isOpen={whatsappModalOpen}
        onClose={() => {
          setWhatsappModalOpen(false);
          loadData();
        }}
        onStatusChange={() => loadData()}
      />
    </div>
  );
};
