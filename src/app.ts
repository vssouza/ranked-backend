import "dotenv/config";
import "./env"   
import Fastify from "fastify";
import {ZodError} from "zod";

import sessionPlugin from "./plugins/session.js";
import authContextPlugin from "./plugins/authContext.js";
import csrfPlugin from "./plugins/csrf.js";

import {registerAuthRoutes} from "./routes/auth.js";
import {registerMeRoute} from "./routes/me.js";
import {registerMemberAddressesRoutes} from "./routes/member-addresses.js";

export function buildApp() {
  const app = Fastify({logger: true});

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        issues: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    // Keep Fastify default error serialization/status handling
    return reply.send(error);
  });

  app.get("/health", async () => "ok");

  // 1) Cookies + encrypted session
  app.register(sessionPlugin);

  // 2) Load req.member from session (if present)
  app.register(authContextPlugin);

  // 3) CSRF protection for cookie auth (unsafe methods)
  app.register(csrfPlugin);

  // 4) Register routes
  app.register(async (routes) => {
    registerAuthRoutes(routes);
    registerMeRoute(routes);
    registerMemberAddressesRoutes(routes);
  });

  return app;
}
