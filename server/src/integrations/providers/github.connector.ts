import { z } from "zod";
import { RiskLevel } from "@nova/shared";
import { AgentTool } from "../../tools/base/agent-tool.interface";
import {
  BaseConnector,
  ConnectionTestResult,
} from "../base/connector.interface";

export class GitHubConnector implements BaseConnector {
  public readonly id = "github";
  public readonly name = "GitHub";
  public readonly description =
    "Manage repositories, create & list issues, track pull requests, and view repo stats.";
  public readonly category = "developer" as const;
  public readonly icon = "Github";
  public readonly authType = "api_key" as const;
  public readonly capabilities = [
    "Repository Summary",
    "List Issues",
    "Create Issues",
    "List Pull Requests",
  ];
  public readonly documentationUrl =
    "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens";

  public readonly credentialFields = [
    {
      key: "token",
      label: "Personal Access Token",
      placeholder: "ghp_...",
      type: "password" as const,
      required: true,
      description: "GitHub Personal Access Token (PAT) with repo scope.",
    },
  ];

  public async testConnection(
    credentials: Record<string, string>
  ): Promise<ConnectionTestResult> {
    const token = credentials.token?.trim();
    if (!token) {
      return { success: false, message: "GitHub Personal Access Token is required" };
    }

    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Nova-Assistant",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          message: `GitHub authentication failed (HTTP ${response.status}): ${errorText}`,
        };
      }

      const data = (await response.json()) as { login: string; name?: string };
      return {
        success: true,
        message: `Connected successfully as GitHub user: @${data.login}${
          data.name ? ` (${data.name})` : ""
        }`,
        details: { user: data.login },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to connect to GitHub: ${err.message || String(err)}`,
      };
    }
  }

  public createTools(credentials: Record<string, string>): AgentTool[] {
    const token = credentials.token?.trim() || "";

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Nova-Assistant",
    };

    // 1. Get Repo Summary Tool
    const getRepoSummaryTool: AgentTool = {
      name: "github_get_repo_summary",
      description:
        "Get detailed information about a GitHub repository, including stars, forks, default branch, and open issues.",
      riskLevel: "LOW",
      inputSchema: z.object({
        owner: z.string().describe("The repository owner (e.g., 'octocat')"),
        repo: z.string().describe("The repository name (e.g., 'Hello-World')"),
      }),
      execute: async ({ owner, repo }) => {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers,
        });
        if (!res.ok) {
          throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
        }
        const data = (await res.json()) as any;
        return {
          name: data.full_name,
          description: data.description,
          stars: data.stargazers_count,
          forks: data.forks_count,
          openIssues: data.open_issues_count,
          defaultBranch: data.default_branch,
          url: data.html_url,
          isPrivate: data.private,
        };
      },
    };

    // 2. List Issues Tool
    const listIssuesTool: AgentTool = {
      name: "github_list_issues",
      description: "List issues in a GitHub repository.",
      riskLevel: "LOW",
      inputSchema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        state: z
          .enum(["open", "closed", "all"])
          .default("open")
          .describe("Issue state"),
        limit: z.number().min(1).max(50).default(10).describe("Max items to return"),
      }),
      execute: async ({ owner, repo, state, limit }) => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`,
          { headers }
        );
        if (!res.ok) {
          throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
        }
        const issues = (await res.json()) as any[];
        // Filter out pull requests which GitHub includes in issues endpoint
        return issues
          .filter((i) => !i.pull_request)
          .map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            author: i.user?.login,
            commentsCount: i.comments,
            labels: i.labels?.map((l: any) => l.name) || [],
            url: i.html_url,
            createdAt: i.created_at,
          }));
      },
    };

    // 3. Create Issue Tool
    const createIssueTool: AgentTool = {
      name: "github_create_issue",
      description: "Create a new issue in a GitHub repository.",
      riskLevel: "MEDIUM",
      inputSchema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        title: z.string().min(1).describe("The title of the issue"),
        body: z.string().optional().describe("Detailed description of the issue"),
        labels: z
          .array(z.string())
          .optional()
          .describe("Labels to attach to the issue"),
      }),
      execute: async ({ owner, repo, title, body, labels }) => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues`,
          {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, labels }),
          }
        );
        if (!res.ok) {
          throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
        }
        const data = (await res.json()) as any;
        return {
          number: data.number,
          title: data.title,
          url: data.html_url,
          state: data.state,
          message: `Created issue #${data.number}: "${data.title}" successfully.`,
        };
      },
    };

    // 4. List Pull Requests Tool
    const listPRsTool: AgentTool = {
      name: "github_list_pull_requests",
      description: "List pull requests in a GitHub repository.",
      riskLevel: "LOW",
      inputSchema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        state: z
          .enum(["open", "closed", "all"])
          .default("open")
          .describe("PR state"),
        limit: z.number().min(1).max(50).default(10).describe("Max PRs to return"),
      }),
      execute: async ({ owner, repo, state, limit }) => {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`,
          { headers }
        );
        if (!res.ok) {
          throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
        }
        const prs = (await res.json()) as any[];
        return prs.map((p) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          author: p.user?.login,
          draft: p.draft,
          headBranch: p.head?.ref,
          baseBranch: p.base?.ref,
          url: p.html_url,
          createdAt: p.created_at,
        }));
      },
    };

    return [getRepoSummaryTool, listIssuesTool, createIssueTool, listPRsTool];
  }
}
