import { Router } from "express";
import {
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  clearConversation,
} from "../controllers/conversation.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

export const conversationRouter = Router();

conversationRouter.use(optionalAuthMiddleware);

conversationRouter.get("/", listConversations);
conversationRouter.post("/", createConversation);
conversationRouter.get("/:id", getConversation);
conversationRouter.patch("/:id", updateConversation);
conversationRouter.delete("/:id", deleteConversation);
conversationRouter.post("/:id/clear", clearConversation);

export default conversationRouter;
