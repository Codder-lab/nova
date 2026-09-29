import readline from "readline";
import { AgentEngine } from "../agents/agent.engine";
import { initializeDefaultTools } from "../tools";
import { OllamaProvider } from "../llm/ollama.provider";
import { connectDB, disconnectDB } from "../db/connection";
import { env } from "../config/env";

async function startCli() {
  initializeDefaultTools();
  await connectDB();
  const llm = new OllamaProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  const engine = new AgentEngine({ llm });

  console.log("\n======================================================");
  console.log("🤖 NOVA AI - Interactive Agent CLI");
  console.log(`📡 Model: ${env.OLLAMA_MODEL} (${env.OLLAMA_BASE_URL})`);
  console.log('💡 Type any request or goal. (Type "exit" to quit)');
  console.log("======================================================\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question("\n👉 Enter goal: ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === "exit") {
        console.log("\nGoodbye! 👋");
        rl.close();
        await disconnectDB();
        process.exit(0);
      }

      console.log("\n⏳ Running agent...\n");
      try {
        const result = await engine.run({
          userId: "cli-user",
          goal: trimmed,
          maxSteps: 8,
        });

        console.log("──────────────────────────────────────────────────────");
        console.log(
          `⏱️ Duration: ${result.durationMs}ms | 🔧 Tools Called: ${result.toolCallsCount}`,
        );
        console.log("📜 Steps Executed:");
        for (const step of result.steps) {
          if (step.type === "tool" && step.toolCall) {
            console.log(
              `   ⚙️ [TOOL] ${step.toolCall.name}(${JSON.stringify(step.toolCall.arguments)})`,
            );
            if (step.toolCall.status === "pending") {
              console.log(
                `      ⏳ [PENDING APPROVAL] Risk: ${step.toolCall.error || "Action suspended"}`,
              );
            } else {
              console.log(
                `      ↪ Result: ${JSON.stringify(step.toolCall.result)}`,
              );
            }
          } else if (step.type === "planning") {
            console.log(`   🧠 [PLAN] ${step.title}`);
          }
        }
        console.log("──────────────────────────────────────────────────────");

        if (
          result.status === "waiting_for_approval" &&
          result.pendingApproval
        ) {
          console.log("\n⚠️  HUMAN-IN-THE-LOOP AUTHORIZATION REQUIRED ⚠️");
          console.log(`🔧 Tool: ${result.pendingApproval.toolName}`);
          console.log(`🛡️ Risk Level: [${result.pendingApproval.riskLevel}]`);
          console.log(`📋 Details: ${result.pendingApproval.explanation}`);
          console.log(`🆔 Run ID: ${result.runId}`);
          console.log("──────────────────────────────────────────────────────");

          rl.question("\n👉 Authorize this action? (y/n): ", async (answer) => {
            const approved =
              answer.trim().toLowerCase() === "y" ||
              answer.trim().toLowerCase() === "yes";
            console.log(
              `\n⏳ Resuming agent with ${approved ? "APPROVAL ✅" : "REJECTION ❌"}...\n`,
            );
            try {
              const resumed = await engine.resume(result.runId, approved);
              console.log(
                "──────────────────────────────────────────────────────",
              );
              console.log("\n💬 Nova Response:\n");
              console.log(resumed.response);
              console.log(
                "──────────────────────────────────────────────────────",
              );
            } catch (resumeErr: any) {
              console.error("❌ Error resuming agent run:", resumeErr.message);
            }
            promptUser();
          });
          return;
        }

        console.log("\n💬 Nova Response:\n");
        console.log(result.response);
        console.log("──────────────────────────────────────────────────────");
      } catch (err: any) {
        console.error("❌ Error executing agent:", err.message);
      }

      promptUser();
    });
  };

  promptUser();
}

startCli();
