import readline from 'readline';
import { AgentEngine } from '../agents/agent.engine';
import { initializeDefaultTools } from '../tools';
import { OllamaProvider } from '../llm/ollama.provider';
import { connectDB, disconnectDB } from '../db/connection';
import { env } from '../config/env';

async function startCli() {
  initializeDefaultTools();
  await connectDB();
  const llm = new OllamaProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  const engine = new AgentEngine({ llm });

  console.log('\n======================================================');
  console.log('🤖 NOVA AI - Interactive Agent CLI');
  console.log(`📡 Model: ${env.OLLAMA_MODEL} (${env.OLLAMA_BASE_URL})`);
  console.log('💡 Type any request or goal. (Type "exit" to quit)');
  console.log('======================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question('\n👉 Enter goal: ', async (input) => {
      const trimmed = input.trim();
      if (!trimmed || trimmed.toLowerCase() === 'exit') {
        console.log('\nGoodbye! 👋');
        rl.close();
        await disconnectDB();
        process.exit(0);
      }

      console.log('\n⏳ Running agent...\n');
      try {
        const result = await engine.run({
          userId: 'cli-user',
          goal: trimmed,
          maxSteps: 8,
        });

        console.log('──────────────────────────────────────────────────────');
        console.log(`⏱️ Duration: ${result.durationMs}ms | 🔧 Tools Called: ${result.toolCallsCount}`);
        console.log('📜 Steps Executed:');
        for (const step of result.steps) {
          if (step.type === 'tool' && step.toolCall) {
            console.log(`   ⚙️ [TOOL] ${step.toolCall.name}(${JSON.stringify(step.toolCall.arguments)})`);
            console.log(`      ↪ Result: ${JSON.stringify(step.toolCall.result)}`);
          } else if (step.type === 'planning') {
            console.log(`   🧠 [PLAN] ${step.title}`);
          }
        }
        console.log('──────────────────────────────────────────────────────');
        console.log('\n💬 Nova Response:\n');
        console.log(result.response);
        console.log('──────────────────────────────────────────────────────');
      } catch (err: any) {
        console.error('❌ Error executing agent:', err.message);
      }

      promptUser();
    });
  };

  promptUser();
}

startCli();
