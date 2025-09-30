import { defineConfig } from '@inkeep/agents-cli/config';

  const config = defineConfig({
    tenantId: "default",
    projectId: "weather-project",
    agentsManageApiUrl: process.env.AGENTS_MANAGE_API_URL || 'http://localhost:3002',
    agentsRunApiUrl: process.env.AGENTS_RUN_API_URL || 'http://localhost:3003',
    modelSettings: {
  "base": {
    "model": "google/gemini-2.5-flash"
  },
  "structuredOutput": {
    "model": "google/gemini-2.5-flash-lite"
  },
  "summarizer": {
    "model": "google/gemini-2.5-flash-lite"
  }
},
  });
      
  export default config;