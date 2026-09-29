import { AgentEngine } from '../agents/agent.engine';
import { initializeDefaultTools } from '../tools';
import { OllamaProvider } from '../llm/ollama.provider';
import { env } from '../config/env';

async function runLiveTest() {
  console.log('====================================================');
  console.log('🤖 NOVA AI - Live Agent Loop Verification with Ollama');
  console.log(`📡 Model: ${env.OLLAMA_MODEL} at ${env.OLLAMA_BASE_URL}`);
  console.log('====================================================\n');

  // Initialize tools
  initializeDefaultTools();

  const llm = new OllamaProvider(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL);
  const engine = new AgentEngine({ llm });

  const goal = 'Calculate 45 * 38, and tell me what is the current time and day in UTC?';
  console.log(`🎯 Goal: "${goal}"\n`);

  try {
    const result = await engine.run({
      userId: 'live-test-user',
      goal,
      maxSteps: 6,
    });

    console.log('🏁 Execution Result:');
    console.log(`- Status: ${result.status}`);
    console.log(`- Duration: ${result.durationMs}ms`);
    console.log(`- Tool Calls Executed: ${result.toolCallsCount}`);
    console.log(`- Total Steps: ${result.steps.length}`);
    console.log('\n📜 Execution Steps:');

    for (const step of result.steps) {
      console.log(`  [Step ${step.stepNumber}] ${step.type.toUpperCase()}: ${step.title}`);
      if (step.toolCall) {
        console.log(`     → Args: ${JSON.stringify(step.toolCall.arguments)}`);
        console.log(`     → Result: ${JSON.stringify(step.toolCall.result)}`);
      }
      if (step.type === 'response') {
        console.log(`     → Response: ${step.description}`);
      }
    }

    console.log('\n💬 Final Agent Response:');
    console.log(result.response);
    console.log('\n✅ Verification successful!');
  } catch (error: any) {
    console.error('❌ Live test failed:', error.message);
    process.exit(1);
  }
}

runLiveTest();
