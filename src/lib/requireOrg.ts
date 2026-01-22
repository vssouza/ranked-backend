import type { preHandlerHookHandler } from "fastify";

export const requireOrg: preHandlerHookHandler = async (req, reply) => {
  if (!req.member) return reply.code(401).send({ error: "Unauthorized" });
  if (!req.org) return reply.code(400).send({ error: "MISSING_ORG_CONTEXT" });
};
