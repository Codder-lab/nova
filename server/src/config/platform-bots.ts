import { PlatformBot } from "@nova/shared";

export const PLATFORM_BOTS: PlatformBot[] = [
  {
    id: "nova-core",
    slug: "nova-core",
    name: "Nova Core",
    avatar: "Sparkles",
    badgeColor: "#6366f1",
    tagline: "Omni-Assistant & General Co-pilot",
    description:
      "Versatile everyday co-pilot equipped with full tool access for general queries, calculations, file inspection, and hybrid workflows.",
    baseSystemPrompt: `You are Nova Core, an intelligent general-purpose agentic AI assistant.
Your goal is to help the user understand and solve problems, answer questions factually, and execute everyday tasks with precision.
Balance structured reasoning with helpful action. If no tool is needed, respond directly with clarity.`,
    defaultModel: "qwen2.5:7b",
    defaultProvider: "ollama",
    availableTools: [
      "get_current_time",
      "calculate",
      "create_task",
      "list_tasks",
      "update_task",
      "complete_task",
      "delete_task",
      "create_reminder",
      "list_reminders",
      "cancel_reminder",
      "save_memory",
      "recall_memory",
      "list_memories",
      "create_schedule",
      "list_schedules",
      "cancel_schedule",
      "web_search",
      "fetch_web_page",
      "open_browser",
      "navigate_to",
      "click_element",
      "type_into",
      "extract_page_content",
      "list_files",
      "read_file",
      "create_file",
    ],
    defaultTone: "default",
    isDefault: true,
    routines: [
      {
        id: "core-daily-overview",
        title: "Daily Overview",
        description: "Check the clock, summarize tasks, and deliver a clean morning briefing.",
        prompt:
          "Check the current time, list my pending tasks, and provide a 3-bullet morning overview to jumpstart my day.",
        icon: "Sun",
      },
      {
        id: "core-quick-calc",
        title: "Quick Math & Time Zone",
        description: "Calculate formulas or check system time offsets.",
        prompt:
          "Check the current time in UTC and tell me how many hours remain in the working day.",
        icon: "Calculator",
      },
    ],
  },
  {
    id: "nova-taskmaster",
    slug: "nova-taskmaster",
    name: "Nova TaskMaster",
    avatar: "CheckSquare",
    badgeColor: "#10b981",
    tagline: "Task & Schedule Architect",
    description:
      "Dedicated productivity planner that organizes daily agendas, triages task backlogs, schedules reminders, and tracks deliverables.",
    baseSystemPrompt: `You are Nova TaskMaster, an executive productivity architect and task manager.
Your primary responsibility is to help the user organize, prioritize, and systematically execute their daily work.
Always break goals into manageable actions, assign clear priorities (low, medium, high, urgent), and confirm task modifications clearly.
Keep the user disciplined and focused on what matters most.`,
    defaultModel: "qwen2.5:7b",
    defaultProvider: "ollama",
    availableTools: [
      "create_task",
      "list_tasks",
      "update_task",
      "complete_task",
      "delete_task",
      "create_reminder",
      "list_reminders",
      "cancel_reminder",
      "create_schedule",
      "list_schedules",
      "cancel_schedule",
      "get_current_time",
      "calculate",
    ],
    defaultTone: "concise",
    routines: [
      {
        id: "taskmaster-morning-standup",
        title: "Morning Standup Briefing",
        description: "Fetch pending tasks and formulate a prioritized 3-tier action plan for today.",
        prompt:
          "Check the current time, retrieve all my pending tasks, and organize them into a prioritized 3-tier daily plan (Must Do, Should Do, If Time Permits).",
        icon: "CheckSquare",
        suggestedCron: "0 9 * * 1-5",
      },
      {
        id: "taskmaster-backlog-triage",
        title: "Backlog Triage & Cleanup",
        description: "Review pending tasks, identify overdue items, and recommend next actions.",
        prompt:
          "List all my tasks. Identify overdue items, flag any bottlenecks, and suggest which items to complete, reschedule, or cancel.",
        icon: "ListFilter",
      },
      {
        id: "taskmaster-evening-review",
        title: "Evening Review & Roll-Over",
        description: "Review today's achievements and set reminders for tomorrow morning.",
        prompt:
          "Review my current tasks. Summarize what is done, list remaining open items, and create a reminder for 9:00 AM tomorrow to resume top priority work.",
        icon: "Clock",
        suggestedCron: "0 18 * * 1-5",
      },
    ],
  },
  {
    id: "nova-scout",
    slug: "nova-scout",
    name: "Nova Scout",
    avatar: "Search",
    badgeColor: "#3b82f6",
    tagline: "Research & Web Intelligence",
    description:
      "Web intelligence specialist engineered for real-time web discovery, article extraction, competitor intelligence, and objective fact-checking.",
    baseSystemPrompt: `You are Nova Scout, an agile research and web intelligence specialist.
Your mission is to find accurate, real-time web information, verify facts, scrape and distill web articles, and deliver high-signal briefings.
Always ground your answers in verified search results. Provide key citations, bulleted highlights, and avoid fluff or unsupported claims.`,
    defaultModel: "qwen2.5:7b",
    defaultProvider: "ollama",
    availableTools: [
      "web_search",
      "fetch_web_page",
      "open_browser",
      "navigate_to",
      "extract_page_content",
      "get_current_time",
      "calculate",
    ],
    defaultTone: "analytical",
    routines: [
      {
        id: "scout-industry-radar",
        title: "Tech & AI Trend Radar",
        description: "Scan real-time web headlines and compile a high-signal executive digest.",
        prompt:
          "Search the web for today's most significant tech and agentic AI news. Provide a 4-bullet executive digest with citations.",
        icon: "Globe",
        suggestedCron: "0 8 * * *",
      },
      {
        id: "scout-fact-check",
        title: "Deep Fact Check",
        description: "Cross-reference claims across multiple sources with credibility analysis.",
        prompt:
          "Search the web to fact-check recent developments in open-source AI models this week and summarize the consensus.",
        icon: "ShieldCheck",
      },
      {
        id: "scout-url-distill",
        title: "Web Article Distiller",
        description: "Fetch web pages and distill key takeaways and data points.",
        prompt:
          "Search the web for the latest official TypeScript release notes, fetch the page, and list the top 3 developer features.",
        icon: "FileText",
      },
    ],
  },
  {
    id: "nova-scribe",
    slug: "nova-scribe",
    name: "Nova Scribe",
    avatar: "PenTool",
    badgeColor: "#8b5cf6",
    tagline: "Executive Drafter & Communicator",
    description:
      "Executive communicator skilled in crafting crisp business emails, synthesizing meeting notes into action items, and saving key context to memory.",
    baseSystemPrompt: `You are Nova Scribe, an executive drafting and communications specialist.
You excel at transforming rough ideas, bullet points, and conversation notes into polished, professional communications.
Focus on tone precision, clarity, structure, and actionable takeaways. Store important facts into memory when instructed.`,
    defaultModel: "qwen2.5:7b",
    defaultProvider: "ollama",
    availableTools: [
      "save_memory",
      "recall_memory",
      "list_memories",
      "create_task",
      "list_tasks",
      "get_current_time",
    ],
    defaultTone: "formal",
    routines: [
      {
        id: "scribe-standup-draft",
        title: "Draft Daily Standup Update",
        description: "Compile task progress into a clean 3-part team status update.",
        prompt:
          "Review my tasks and draft a clean 3-part standup update: 1) Completed Yesterday, 2) Focus for Today, 3) Blockers or Dependencies.",
        icon: "Mail",
      },
      {
        id: "scribe-meeting-prep",
        title: "Meeting Prep Briefing",
        description: "Structure a crisp 5-point meeting agenda with desired outcomes.",
        prompt:
          "Help me prepare for an upcoming team sync. Create a structured 5-point meeting agenda with time allocations and clear goals.",
        icon: "FileSignature",
      },
      {
        id: "scribe-action-extractor",
        title: "Extract Action Items & Save Notes",
        description: "Distill notes into actionable tasks and persist critical context into memory.",
        prompt:
          "Check my saved memories and pending tasks. Summarize my key commitments and confirm everything is properly organized.",
        icon: "BookmarkPlus",
      },
    ],
  },
];

export function getPlatformBotBySlug(slug?: string): PlatformBot {
  if (!slug) return PLATFORM_BOTS[0];
  const found = PLATFORM_BOTS.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
  return found || PLATFORM_BOTS[0];
}
