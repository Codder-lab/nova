import { Router } from "express";
import {
  getConnectors,
  getUserIntegrations,
  saveIntegration,
  testIntegration,
  toggleIntegration,
  deleteIntegration,
} from "../controllers/integration.controller";
import { optionalAuthMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Allow optional auth so anonymous users can also test/use integrations locally
router.use(optionalAuthMiddleware);

router.get("/connectors", getConnectors);
router.get("/", getUserIntegrations);
router.post("/", saveIntegration);
router.post("/test", testIntegration);
router.patch("/:connectorId/toggle", toggleIntegration);
router.delete("/:connectorId", deleteIntegration);

export default router;
