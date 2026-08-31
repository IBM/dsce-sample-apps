# 🚛 FleetOps Agent Builder — Base Mode

A specialized **Bob AI mode** for building watsonx Orchestrate agents and Python tools for FleetOps cold-chain logistics operations.

> **Built-in knowledge:** This mode comes pre-loaded with FleetOps domain expertise including cold-chain logistics patterns, agent orchestration workflows, API integration patterns, and best practices for building production-ready agents.

---

## What It Does

The **FleetOps Agent Builder** mode guides you through building watsonx Orchestrate agents and tools for cold-chain logistics:

```
Discovery → Planning → Implementation → Testing → Deployment → Documentation
```

| Phase | What Happens |
|-------|-------------|
| 🔍 **Discovery** | Bob asks questions to understand your agent/tool requirements |
| 📋 **Planning** | Creates detailed plan.md for your approval (optional) |
| ⚙️ **Implementation** | Builds agent YAML files and Python tools with proper patterns |
| ✅ **Testing** | Validates agent instructions and tool implementations |
| 🚀 **Deployment** | Generates deployment scripts for watsonx Orchestrate |
| 📚 **Documentation** | Creates comprehensive README and usage guides |

---

## Key Features

- **FleetOps Domain Expertise** — understands cold-chain logistics, temperature monitoring, emergency reroutes
- **Agent Orchestration** — knows the Weather → Station → Route → Decision → Notification workflow
- **Python Tool Patterns** — implements tools with @tool decorator, Pydantic models, and API integration
- **JSON Output Formats** — ensures agents output pure JSON for sequential workflows
- **Data Passthrough** — implements proper data flow between agents
- **Error Handling** — includes retry logic and graceful degradation patterns
- **API Integration** — connects to FleetOps backend services
- **Best Practices** — follows watsonx Orchestrate ADK standards

---

## Built-in Knowledge

This mode has the following FleetOps-specific knowledge:

### 🧠 Domain Concepts
- **Cold-chain logistics** — temperature-sensitive cargo management
- **Critical thresholds** — pharmaceutical (2-8°C), frozen (-18°C), perishables (0-4°C)
- **Time to spoilage** — urgency levels and risk assessment
- **Emergency reroutes** — decision-making logic and facility selection
- **Weather impact** — route analysis and delay estimation

### 🔄 Agent Orchestration Patterns
- **Sequential workflows** — Weather → Station → Route → Decision → Notification
- **Data passthrough** — agents pass ALL data without modification
- **JSON output** — pure JSON format for agent-to-agent communication
- **Error handling** — retry logic and fallback strategies
- **Decision authority** — only Decision Agent makes recommendations

### 🛠️ Technical Patterns
- **Agent YAML structure** — spec_version, kind, name, llm, instructions, tools, config
- **Pydantic models** — BaseModel, Field, validators, nested models, Enums
- **@tool decorator** — proper usage with input/output schemas
- **API integration** — requests, timeouts, error handling, response validation
- **Requirements.txt** — dependency management

---

## What Gets Built

A typical FleetOps agent project looks like:

```
fleetops-agents/
├── agents/
│   ├── weather_advisor.yaml
│   ├── station_agent.yaml
│   ├── route_optimization_agent.yaml
│   ├── decision_agent.yaml
│   └── notification_agent.yaml
├── tools/
│   ├── weather_forecast/
│   │   ├── weather_forecast_tool.py
│   │   ├── config.py
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── station_tool/
│   │   ├── station_search_tool.py
│   │   └── requirements.txt
│   ├── decision_tool/
│   │   ├── decision_analysis_tool.py
│   │   └── requirements.txt
│   └── whatsapp_notification/
│       ├── whatsapp_notification_tool.py
│       └── requirements.txt
├── scripts/
│   ├── deploy.sh
│   └── test-agents.sh
├── plan.md
└── README.md
```

---

## Setup & Installation

1. **Clone or download this mode**
   ```bash
   cd /path/to/your/project
   cp -r /path/to/fleetops-base-mode .
   ```

2. **Open the project folder in Bob**
   - The folder containing the `.bob` directory becomes your workspace
   - Bob will automatically detect the FleetOps Agent Builder mode

3. **That's it!** — The `🚛 FleetOps Agent Builder` mode will appear in Bob's mode selector

---

## How to Use

### Creating a New Agent

1. **Switch to FleetOps Agent Builder mode** in Bob
2. **Tell Bob what you want to build**
   - "Create a weather analysis agent"
   - "Build a tool to search for service facilities"
   - "Implement the decision-making agent"
3. **Answer discovery questions** (Bob asks 2-3 at a time)
4. **Review the plan** (optional plan.md file)
5. **Bob builds everything** — agent YAML, Python tools, tests, docs
6. **Deploy to watsonx Orchestrate**

### Example Session

```
You: "I need to create a weather advisor agent that analyzes conditions along truck routes"

Bob: "Great! Let me ask a few questions to understand the requirements:
1. What input should this agent receive? (e.g., truck ID, route waypoints)
2. What weather data sources will it use?
3. What output format is needed for the next agent in the workflow?"

You: [Answers questions]

Bob: "Would you like me to create a detailed plan.md before implementation?"

You: "Yes"

Bob: [Creates plan.md, gets approval, then builds agent YAML and Python tool]
```

---

## Agent Types Supported

### 1. Weather Advisor Agent
- **Purpose**: Analyze weather conditions along routes
- **Input**: truck_id
- **Output**: Weather analysis with risk scores
- **Tools**: get_route_weather_forecast

### 2. Station Agent
- **Purpose**: Search for service facilities
- **Input**: Search criteria, required capabilities
- **Output**: List of available facilities
- **Tools**: search_stations

### 3. Route Optimization Agent
- **Purpose**: Calculate optimal routes to facilities
- **Input**: Facilities, truck location
- **Output**: Ranked routes with costs
- **Tools**: route_optimizer

### 4. Decision Agent
- **Purpose**: Make final reroute decisions
- **Input**: All previous agent outputs + telemetry + cargo data
- **Output**: Decision with recommendations
- **Tools**: analyze_decision

### 5. Notification Agent
- **Purpose**: Send alerts to drivers
- **Input**: Decision output
- **Output**: Notification delivery status
- **Tools**: send_whatsapp_notification

---

## Best Practices

### Agent Development
- ✅ Use clear, descriptive agent names in snake_case
- ✅ Write comprehensive instructions with examples
- ✅ Always specify exact JSON output format
- ✅ Include error handling and retry logic
- ✅ Document tool usage patterns clearly
- ✅ Use enable_cot: true for complex reasoning agents

### Tool Development
- ✅ Define clear Pydantic models for inputs and outputs
- ✅ Use @tool decorator from watsonx Orchestrate ADK
- ✅ Include proper error handling for API calls
- ✅ Set appropriate timeouts (10 seconds recommended)
- ✅ Validate all inputs and outputs
- ✅ Use environment variables for configuration
- ✅ Write comprehensive docstrings

### Workflow Integration
- ✅ Ensure agents pass ALL data to next agent
- ✅ Use pure JSON output (no markdown, no explanations)
- ✅ Implement data passthrough principles
- ✅ Only Decision Agent makes recommendations
- ✅ Include safety buffers in time calculations

---

## Prerequisites

- Bob AI with mode support
- IBM watsonx Orchestrate access
- Python 3.10+
- FleetOps backend API access (for tool integration)

---

## File Structure

```
base-modes/fleetops-base-mode/
├── .bob/
│   ├── custom_modes.yaml                           # Mode configuration
│   └── rules-fleetops-agent-builder/               # Instruction files
│       ├── 1_discovery_and_workflow.xml            # Discovery phase and workflow
│       ├── 2_agent_development_patterns.xml        # Agent YAML patterns
│       ├── 3_tool_development_patterns.xml         # Python tool patterns
│       └── 4_fleetops_domain_knowledge.xml         # Domain expertise
└── README.md                                        # This file
```

---

## Example: Creating a Weather Advisor Agent

```yaml
spec_version: v1
kind: native
name: weather_advisor
llm: groq/openai/gpt-oss-120b
description: Analyzes weather conditions along truck routes for cold-chain logistics
title: Route Weather Advisor

instructions: |
  You are a Route Weather Advisor for cold-chain pharmaceutical logistics.
  
  Your role is to:
  1. Analyze weather conditions along truck routes
  2. Identify potential hazards (storms, extreme temperatures, ice)
  3. Provide detailed forecasts for waypoints
  
  CRITICAL: You MUST respond in JSON format:
  {
    "severeWeatherDetected": boolean,
    "overallWeatherRisk": integer (0-100),
    "totalDelayMinutes": integer,
    "segments": [...]
  }

tools:
  - get_route_weather_forecast

config:
  hidden: false
  enable_cot: true
```

---

## Troubleshooting

### Agent Not Outputting JSON
- Check instructions include "CRITICAL: You MUST return ONLY a valid JSON object"
- Ensure no markdown formatting instructions (```json)
- Verify JSON schema is clearly defined

### Tool Import Errors
- Check requirements.txt includes all dependencies
- Verify @tool decorator is imported correctly
- Ensure Pydantic models are properly defined

### API Integration Issues
- Verify FleetOps API URL is correct
- Check timeout settings (default: 10 seconds)
- Ensure error handling is implemented

---

## Resources

- [IBM watsonx Orchestrate Documentation](https://www.ibm.com/docs/en/watsonx/orchestrate)
- [Agentic Development Kit (ADK)](https://developer.watson-orchestrate.ibm.com)
- [Pydantic Documentation](https://docs.pydantic.dev/)

---

## Version History

- **v1.0.0** (2026-06-02)
  - Initial release
  - 4 instruction files covering full lifecycle
  - FleetOps domain knowledge
  - Agent and tool development patterns
  - Discovery-first workflow

---

**Ready to build your first FleetOps agent?** Switch to the FleetOps Agent Builder mode and let's get started! 🚀
