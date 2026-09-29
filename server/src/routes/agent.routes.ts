import { Router } from 'express';
import { runAgent, listTools } from '../controllers/agent.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

export const agentRouter = Router();

agentRouter.post('/run', optionalAuthMiddleware, runAgent);
agentRouter.get('/tools', listTools);
