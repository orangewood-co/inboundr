import { tool } from "ai";
import { z } from "zod";

import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";
import { searchKnowledge } from "../services/drive-knowledge.service";

type KnowledgeToolContext = {
  user: AuthenticatedRequest["user"];
  organization: OrganizationRequest["organization"];
  organizationMembership: OrganizationRequest["organizationMembership"];
};

// Keep snippets short enough to be useful as context without bloating the
// tool result that gets fed back into the model.
const MAX_SNIPPET_CHARS = 1500;

export function createKnowledgeTools(context: KnowledgeToolContext) {
  return {
    searchKnowledgeBase: tool({
      description:
        "Search the organization's documents that were marked 'Use for chat context' in Drive. Use this to answer questions about the user's uploaded files, manuals, policies, reports, or any folder content they have shared. Always cite the source file names in your answer.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("A natural-language search query describing the information you need."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .default(5)
          .describe("Maximum number of document snippets to return."),
      }),
      execute: async ({ query, limit }) => {
        const matches = await searchKnowledge({
          organizationId: context.organization._id.toString(),
          query,
          limit,
        });

        return {
          query,
          matchCount: matches.length,
          matches: matches.map((match) => ({
            fileName: match.fileName,
            nodeId: match.nodeId,
            score: Number(match.score.toFixed(4)),
            snippet: match.content.slice(0, MAX_SNIPPET_CHARS),
          })),
        };
      },
    }),
  };
}
