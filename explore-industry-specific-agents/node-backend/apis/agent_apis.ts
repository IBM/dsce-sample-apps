import express from "express";
import AgentService from "../src/core/agent";

const router = express.Router();
const agentService = new AgentService();

/**
 * @swagger
 * tags:
 *   name: Bee Agent Framework Configuration
 *   description: APIs for managing Bee Agent Framework configuration
 */

/**
 * @swagger
 * /v1/bee-agent-framework/save_config:
 *   post:
 *     summary: Save the agent configuration
 *     tags: [Bee Agent Framework Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               framework:
 *                 type: string
 *               tools:
 *                 type: array
 *                 items:
 *                   type: string
 *               memory:
 *                 type: string
 *               llm_providers:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   config:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         ibm_cloud_api_key:
 *                           type: string
 *                         model_id:
 *                           type: string
 *                         parameters:
 *                           type: object
 *                           properties:
 *                             max_new_tokens:
 *                               type: string
 *                             min_new_tokens:
 *                               type: string
 *                             decoding_method:
 *                               type: string
 *                         wx_project_id:
 *                           type: string
 */
router.post("/v1/bee-agent-framework/save_config", (req, res) => {
  const configPayload = req.body;

  try {
    // Validate the payload
    if (!configPayload.llm_providers || !configPayload.llm_providers.config) {
      return res.status(400).json({ error: "Invalid configuration payload" });
    }
    // Handle the promise
    agentService.setAgentConfig(configPayload)
      .then(result => {
        res.json({ output: result.output });
      })
      .catch(error => {
        console.error("Error saving configuration:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  } catch (error) {
    console.error("Error saving configuration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /v1/bee-agent-framework/generate:
 *   post:
 *     summary: Generate a response from the agent
 *     tags: [Bee Agent Framework Configuration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input_data:
 *                 type: string
 */
router.post("/v1/bee-agent-framework/generate", async (req, res) => {
  const prompt = req.body.input_data;

  try {
    agentService.runAgent(prompt)
      .then(result => {
        res.json({output: result});
      })
      .catch(error => {
        console.error("Error running the agent:", error);
        res.status(500).json({ error: "Internal server error" });
      });
  } catch (error) {
    console.error("Error running the agent:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;  // Export router properly


/**
 * @swagger
 * /v1/bee-agent-framework/get_config_params:
 *   get:
 *     summary: Get the configuration parameters
 *     tags: [Configuration]
 */
router.get("/v1/bee-agent-framework/get_config_params", async (req, res) => {
  const jsonPayload = {
    "tools": [
      {
        "name": "WikipediaTool",
        "description": "A tool for retrieving information from Wikipedia."
      },
      {
        "name": "DuckDuckGoTool",
        "description": "A tool for searching the web using DuckDuckGo."
      },
      {
        "name": "ArXivTool",
        "description": "A tool for retrieving academic papers from ArXiv."
      },
      {
        "name": "WebCrawlerTool",
        "description": "A tool for crawling the web and extracting data."
      },
      {
        "name": "OpenMeteoTool",
        "description": "A tool for retrieving weather data from OpenMeteo."
      }
    ],
    "memory": [
      {
        "name": "Unconstrained Memory",
        "description": "Unlimited size. It is suitable if your context window is huge."
      },
      {
        "name": "Sliding Window Memory",
        "description": "Keeps last k messages in the memory. The oldest ones are deleted."
      },
      {
        "name": "Token Memory",
        "description": "Ensures that the number of tokens of all messages is below the given threshold. The oldest are removed."
      },
      {
        "name": "Summarize Memory",
        "description": "Only a single summarization of the conversation is preserved. Summarization is updated with every new message."
      }
    ],
    "llm_providers": [
      {
        "name": "OpenAI",
        "description": "OpenAI's foundation models",
        "config": [
          {
            "model_id": "gpt-3.5-turbo",
            "parameters": {
              "max_new_tokens": "10",
              "stop": [
                "post"
              ]
            }
          }
        ]
      },
      {
        "name": "watsonx.ai",
        "description": "IBM's watsonx.ai foundation models",
        "config": [
          {
            "model_id": "meta-llama/llama-3-3-70b-instruct",
            "parameters": {
              "max_new_tokens": "500",
              "min_new_tokens": "10",
              "decoding_method": "greedy"
            }
          }
        ]
      }
    ],
    "additional_config": [
      {
        "name": "cache",
        "description": "Caching is a process used to temporarily store copies of data or computations in a cache (a storage location) to facilitate faster access upon future requests.",
        "config": [
          {
            "name": "Unconstrained Cache",
            "description": "Unlimited size."
          },
          {
            "name": "File Cache",
            "description": "Saves/Loads entries to/from a file"
          },
          {
            "name": "Sliding Cache",
            "description": "Keeps last k entries in the memory. The oldest ones are deleted."
          },
          {
            "name": "Null Cache",
            "description": "Disables caching."
          }
        ]
      }
    ]
  }
  try {
    res.json(jsonPayload);
  } catch (error) {
    console.error("Error getting configuration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * @swagger
 * /:
 *   get:
 *     summary: Home route
 *     tags: [Others]
 */
router.get("/", async (req, res) => {
  res.redirect("/docs");
});