import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  LogOut,
  Send,
  Bot,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import {
  fetchWhatsAppStatus,
  connectWhatsApp,
  logoutWhatsApp,
  sendWhatsAppMessage,
  updateWhatsAppSettings,
  type WhatsAppStatus,
} from "@/services/whatsapp.service";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: WhatsAppStatus) => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from Nova AI Assistant!");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = async () => {
    try {
      const data = await fetchWhatsAppStatus();
      setStatus(data);
      if (onStatusChange) onStatusChange(data);
    } catch (err: any) {
      console.error("Failed loading WhatsApp status:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();

      // Poll status every 2.5s while modal is open
      pollTimerRef.current = setInterval(() => {
        loadStatus();
      }, 2500);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setTestResult(null);
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [isOpen]);

  const handleStartConnect = async () => {
    setIsConnecting(true);
    setTestResult(null);
    try {
      const data = await connectWhatsApp();
      setStatus(data);
      if (onStatusChange) onStatusChange(data);
    } catch (err: any) {
      console.error("Connect error:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutWhatsApp();
      await loadStatus();
    } catch (err: any) {
      console.error("Logout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleAutoReplyToggle = async (enabled: boolean) => {
    if (!status) return;
    setStatus({ ...status, autoReplyEnabled: enabled });
    try {
      await updateWhatsAppSettings(enabled);
      await loadStatus();
    } catch (err: any) {
      console.error("Toggle error:", err);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testMessage.trim()) return;

    setIsSending(true);
    setTestResult(null);
    try {
      const res = await sendWhatsAppMessage(testRecipient, testMessage);
      if (res.success) {
        setTestResult({
          success: true,
          message: res.message || "Message sent successfully!",
        });
      } else {
        setTestResult({
          success: false,
          message: res.error || "Failed to send message",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Network error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="sm:max-w-[540px] bg-card border-border"
    >
      {/* Header */}
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-semibold text-foreground" onClose={onClose}>
                WhatsApp Assistant
              </DialogTitle>
              {status?.isConnected ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] gap-1 px-1.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Multi-Device QR
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Autonomous Two-Way AI Bot & Outbound Agent Tool
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Content */}
      <div className="space-y-4 py-3 text-sm">
        {/* If Connected */}
        {status?.isConnected ? (
          <div className="space-y-4">
            {/* Connected Status Card */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 text-xs">
                    Linked & Connected
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {status.user?.phone ? `+${status.user.phone}` : "WhatsApp Account"}
                    {status.user?.name ? ` (${status.user.name})` : ""}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="h-7 text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10 gap-1 cursor-pointer"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LogOut className="w-3 h-3" />
                )}
                <span>Unlink</span>
              </Button>
            </div>

            {/* Two-Way Auto-Reply Setting */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-center justify-between">
              <div className="space-y-0.5 pr-4">
                <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                  <Bot className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Two-Way AI Chat Assistant</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Automatically process incoming messages through Nova Agent and reply in real time.
                </p>
              </div>
              <Switch
                checked={status.autoReplyEnabled}
                onCheckedChange={handleAutoReplyToggle}
              />
            </div>

            {/* Outbound Test Message Form */}
            <form onSubmit={handleSendTest} className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <h5 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                  Send Test Message
                </h5>
                <span className="text-[10px] text-muted-foreground">
                  Uses Nova WhatsApp Tool
                </span>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder="Recipient Phone (e.g. +1234567890 or 919876543210)"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  placeholder="Message content"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="text-xs h-8"
                />
              </div>

              {testResult && (
                <div
                  className={`text-xs p-2 rounded-lg flex items-center gap-2 ${
                    testResult.success
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSending || !testRecipient.trim() || !testMessage.trim()}
                className="w-full text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 cursor-pointer"
              >
                {isSending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                <span>Send Message</span>
              </Button>
            </form>
          </div>
        ) : status?.status === "qr_ready" && status?.qrDataUrl ? (
          /* QR Code Scan View */
          <div className="flex flex-col items-center text-center space-y-4 py-1">
            <div className="relative p-3 bg-white rounded-2xl shadow-md border-2 border-emerald-500/30">
              <img
                src={status.qrDataUrl}
                alt="WhatsApp QR Code"
                className="w-52 h-52 object-contain rounded-lg"
              />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Scan with Phone
              </div>
            </div>

            <div className="text-left bg-muted/40 p-3 rounded-xl border border-border w-full space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-xs">
                How to link:
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li>Open WhatsApp on your mobile phone</li>
                <li>Tap <b>Menu (⋮)</b> or <b>Settings (⚙️)</b></li>
                <li>Select <b>Linked Devices</b> &gt; <b>Link a Device</b></li>
                <li>Point your camera at this QR code</li>
              </ol>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleStartConnect}
              disabled={isConnecting}
              className="text-xs h-7 gap-1.5 cursor-pointer"
            >
              {isConnecting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>Refresh QR Code</span>
            </Button>
          </div>
        ) : (
          /* Initial Disconnected View */
          <div className="space-y-4 py-1">
            <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>No API Keys or Credit Card Required</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Connect Nova directly using WhatsApp Multi-Device pairing. Scan a QR code from your phone to enable two-way AI chats and agent tools.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Two-Way Assistant
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Chat with Nova from any WhatsApp chat; it runs autonomous goals and replies.
                </p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Agent Outbound Tools
                </p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Nova can send alerts, reminders, reports, and media to any phone number.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleStartConnect}
                disabled={isConnecting}
                className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-2 cursor-pointer shadow-md"
              >
                {isConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <QrCode className="w-3.5 h-3.5" />
                )}
                <span>Generate WhatsApp QR Code</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <DialogFooter>
        <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Multi-Device Protocol
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs cursor-pointer">
            Close
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
};
