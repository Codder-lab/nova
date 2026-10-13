import { Router } from "express";
import {
  getConnectors,
  getUserIntegrations,
  saveIntegration,
  testIntegration,
  toggleIntegration,
  deleteIntegration,
} from "../controllers/integration.controller";
import {
  getGoogleAuthConfig,
  getGoogleAuthUrl,
  handleGoogleCallback,
} from "../controllers/google-auth.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Google OAuth endpoints (accessible with optional auth or for callbacks)
router.get("/google/config", optionalAuthMiddleware, getGoogleAuthConfig);
router.get("/google/auth-url", optionalAuthMiddleware, getGoogleAuthUrl);
router.get("/google/callback", handleGoogleCallback);

// Allow optional auth so anonymous users can also test/use integrations locally
router.use(optionalAuthMiddleware);

router.get("/connectors", getConnectors);
router.get("/", getUserIntegrations);
router.post("/", saveIntegration);
router.post("/test", testIntegration);
router.patch("/:connectorId/toggle", toggleIntegration);
router.delete("/:connectorId", deleteIntegration);

export default router;
