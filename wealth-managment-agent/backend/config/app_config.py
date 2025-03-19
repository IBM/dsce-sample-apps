import os
from enum import Enum

class ModelEnum(str, Enum):
    # Models that are good at reasoning
    LLAMA_3_70_B_INSTRUCT = 'meta-llama/llama-3-3-70b-instruct'
    GRANITE_3_8_B_INSTRUCT = 'ibm/granite-3-8b-instruct'
    MISTRAL_LARGE = 'mistralai/mistral-large'
    LLAMA_3_90_B_VISION = 'meta-llama/llama-3-2-90b-vision-instruct'

class PromptEnum(str, Enum):
    AGENT_PLANNING_PROMPT = "config/planning_prompt.txt"
    GOLDMAN_REPORT_EXTRACTION_PROMPT = "config/goldman_report_extraction_prompt.txt"
    SUMMARIZER_PROMPT = "config/summarizer_prompt.txt"
    TRANSCRIPT_SUMMARIZER_PROMPT = "config/transcript_summarizer_prompt.txt"

class ToolCacheEnum(str, Enum):
    GOLDMAN_TOOL_CACHE = "cache/tools/goldman_report_cache.txt"
    PORTFOLIO_TOOL_CACHE = "cache/tools/portfolio_retriever_cache.txt"
    SUMMARIZER_TOOL_CACHE = "cache/tools/summarizer_tool_cache.txt"
    TRANSCRIPT_TOOL_CACHE = "cache/tools/transcript_summary_cache.txt"
    WEB_SEARCH_TOOL_CACHE = "cache/tools/web_search_tool_cache.json"
    PYTHON_REPL_TOOL_CACHE = "cache/tools/python_repl_cache.txt"
    SAVE_PDF_TO_DISK_CACHE = "cache/tools/save_pdf_to_disk_cache.txt"

class AppConfig:
    FASTAPI_KEY = os.getenv("FASTAPI_KEY")
    WX_ENDPOINT = os.getenv("WX_ENDPOINT")
    IBM_CLOUD_API_KEY = os.getenv("IBM_CLOUD_API_KEY")
    WX_PROJECT_ID = os.getenv("WX_PROJECT_ID")
    MODEL = ModelEnum
    PROMPT = PromptEnum
    PARAMETERS = {
        "decoding_method": "greedy",
        "min_new_tokens": 1,
        "max_new_tokens": 3000,
        "repetition_penalty": 1
    }
    AGENT_VERBOSE = True # Set to True to see the agent's thought, action and observation process in the console
    CSV_FILE_PATH = "docs/Example Stock portfolio.csv"
    CALL_TRANSCRIPT_PATH = "docs/Wealth Manager Consultation Call Transcript.docx"
    USE_TOOL_CACHE = True if os.getenv('USE_TOOL_CACHE').lower() == 'true' else False
    TOOL_CACHE = ToolCacheEnum
    FILE_SAVE_PATH = "public/static/reports/portfolio_report.pdf"