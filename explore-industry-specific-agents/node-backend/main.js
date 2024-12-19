import express from "express";
import cors from "cors"; // Import the cors package
import agentAPIs from "./apis/agent_apis"; // Import default router from agent_apis.js
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';

const app = express();
app.use(cors()); // Allow CORS for all origins
app.use(express.json()); // For parsing JSON request bodies

// Swagger configuration options
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Bee Agent Framework',
      description: 'APIs for Bee Agent Framework configuration',
      version: '1.0.0',
      license: {
        name: 'MIT License',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    components: {
      schemas: {
        AgentConfig: {
          type: 'object',
          properties: {
            framework: {
              type: 'string',
            },
            tools: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            memory: {
              type: 'string',
            },
            llm_providers: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
                config: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      ibm_cloud_api_key: {
                        type: 'string',
                      },
                      model_id: {
                        type: 'string',
                      },
                      parameters: {
                        type: 'object',
                        properties: {
                          max_new_tokens: {
                            type: 'string',
                          },
                          min_new_tokens: {
                            type: 'string',
                          },
                          decoding_method: {
                            type: 'string',
                          },
                        },
                      },
                      wx_project_id: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
        AgentPrompt: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
            },
          },
        },
      },
    },
  },
  apis: ['./apis/*.ts'], // Path to the API routes folder
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Use the agent API routes
app.use("/api", agentAPIs);  // Mount the router middleware

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
