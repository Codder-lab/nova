import { Router } from "express";
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  logoutWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppMedia,
  updateWhatsAppSettings,
} from "../controllers/whatsapp.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

export const whatsappRouter = Router();

whatsappRouter.use(optionalAuthMiddleware);

whatsappRouter.get("/status", getWhatsAppStatus);
whatsappRouter.post("/connect", connectWhatsApp);
whatsappRouter.post("/disconnect", disconnectWhatsApp);
whatsappRouter.post("/logout", logoutWhatsApp);
whatsappRouter.post("/send", sendWhatsAppMessage);
whatsappRouter.post("/send-media", sendWhatsAppMedia);
whatsappRouter.patch("/settings", updateWhatsAppSettings);

export default whatsappRouter;
