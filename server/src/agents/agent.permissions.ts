import { RiskLevel } from "@nova/shared";

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  READ: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export interface PermissionPolicy {
  autoApproveThreshold: RiskLevel; // Actions at or above this require approval
  alwaysApproveTools?: string[];
  alwaysRequireApprovalTools?: string[];
}

export const DEFAULT_PERMISSION_POLICY: PermissionPolicy = {
  autoApproveThreshold: "MEDIUM", // READ and LOW auto-execute; MEDIUM, HIGH, CRITICAL require approval
  alwaysApproveTools: [],
  alwaysRequireApprovalTools: ["delete_task", "click_element", "type_into"],
};

export class PermissionEngine {
  private policy: PermissionPolicy;

  constructor(policy: PermissionPolicy = DEFAULT_PERMISSION_POLICY) {
    this.policy = policy;
  }

  public requiresApproval(
    toolName: string,
    riskLevel: RiskLevel,
    customPolicy?: Partial<PermissionPolicy>,
  ): boolean {
    const activePolicy = { ...this.policy, ...customPolicy };

    if (activePolicy.alwaysApproveTools?.includes(toolName)) {
      return false;
    }

    if (activePolicy.alwaysRequireApprovalTools?.includes(toolName)) {
      return true;
    }

    const toolWeight = RISK_WEIGHTS[riskLevel] ?? 0;
    const thresholdWeight =
      RISK_WEIGHTS[activePolicy.autoApproveThreshold] ?? 2;

    return toolWeight >= thresholdWeight;
  }

  public getRiskExplanation(
    toolName: string,
    riskLevel: RiskLevel,
    args: Record<string, unknown>,
  ): string {
    switch (toolName) {
      case "delete_task":
        return `Permanently deleting a task (ID/Title: "${args.taskId || "unknown"}").`;
      case "click_element":
        return `Clicking interactive element in browser (target: "${args.selector || args.text || "unknown"}").`;
      case "type_into":
        return `Typing text into input form in browser (selector: "${args.selector || "unknown"}").`;
      default:
        return `Action "${toolName}" has risk level [${riskLevel}], which requires human authorization.`;
    }
  }
}

export const permissionEngine = new PermissionEngine();
