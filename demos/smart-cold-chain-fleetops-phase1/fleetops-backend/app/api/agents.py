"""Agent API endpoints for watsonx Orchestrate integration"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
import logging
import sys
from ..models.agent import (
    AgentExecuteRequest,
    AgentExecuteResponse,
    AgentExecution,
    AgentHistoryResponse,
    ExecutionStatusEnum
)
from ..services.agent_service import agent_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/execute", response_model=AgentExecuteResponse)
async def execute_agent_workflow(
    request: AgentExecuteRequest,
    background_tasks: BackgroundTasks
):
    """
    Execute agent workflow for a specific truck.
    
    The workflow executes sequentially:
    1. Weather Agent - Analyzes weather conditions along route
    2. Station Agent - Finds service stations
    3. Route Agent - Optimizes route with station stops
    4. Decision Agent - Makes final recommendation
    
    Returns immediately with execution_id for status polling.
    """
    logger.info(f"=== AGENT EXECUTE API CALLED === truck_id={request.truck_id}")
    sys.stdout.flush()
    try:
        # Execute workflow asynchronously
        logger.info(f"Starting agent workflow for truck {request.truck_id}")
        sys.stdout.flush()
        execution = await agent_service.execute_agent_workflow(request.truck_id)
        logger.info(f"Agent workflow started with execution_id={execution.execution_id}")
        sys.stdout.flush()
        
        logger.info(f"Returning response for execution_id={execution.execution_id}, status={execution.status}")
        sys.stdout.flush()
        
        # Return response with execution details
        return AgentExecuteResponse(
            execution_id=execution.execution_id,
            truck_id=execution.truck_id,
            status=execution.status,
            started_at=execution.started_at,
            agents=execution.agents
        )
    except ValueError as e:
        logger.error(f"ValueError in execute_agent_workflow: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Exception in execute_agent_workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start agent workflow: {str(e)}")


@router.get("/status/{execution_id}", response_model=AgentExecution)
async def get_agent_status(execution_id: str):
    """
    Get real-time status of agent execution.
    
    Poll this endpoint to track progress of the agent workflow.
    Returns current status of all agents and their outputs.
    """
    logger.debug(f"Status check for execution_id={execution_id}")
    execution = agent_service.get_agent_status(execution_id)
    if not execution:
        logger.warning(f"Execution {execution_id} not found")
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
    logger.debug(f"Returning status for {execution_id}: {execution.status}")
    return execution


@router.get("/history", response_model=AgentHistoryResponse)
async def get_execution_history(
    truck_id: Optional[str] = None,
    limit: int = 10
):
    """
    Get historical agent executions.
    
    Query Parameters:
    - truck_id: Filter by specific truck (optional)
    - limit: Maximum number of executions to return (default: 10)
    """
    logger.info(f"History request: truck_id={truck_id}, limit={limit}")
    executions = agent_service.get_execution_history(truck_id=truck_id, limit=limit)
    logger.info(f"Returning {len(executions)} executions")
    return AgentHistoryResponse(executions=executions)


@router.get("/notifications/{truck_id}")
async def get_truck_notifications(truck_id: str):
    """
    Get all notifications for a specific truck.
    
    Returns notifications sent by the Notification Agent after decision execution.
    These are displayed in the Driver View notifications panel.
    
    Path Parameters:
    - truck_id: The truck ID to get notifications for
    """
    logger.info(f"Fetching notifications for truck {truck_id}")
    notifications = agent_service.get_notifications(truck_id)
    logger.info(f"Returning {len(notifications)} notifications for truck {truck_id}")
    return {"truck_id": truck_id, "notifications": notifications}


