import os
from langchain_ibm import WatsonxLLM, ChatWatsonx
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
from ibm_watsonx_ai.metanames import GenChatParamsMetaNames as ChatParams

class ChatWatsonxWithRetry(ChatWatsonx):
    def invoke(self, *args, max_retries=3, **kwargs):
        """
        Call the invoke method with retry mechanism.
        :param max_retries: Maximum number of retries if invoke fails.
        """
        attempt = 0
        while attempt < max_retries:
            try:
                return super().invoke(*args, **kwargs)
            except Exception as e:
                attempt += 1
                if attempt >= max_retries:
                    raise e  # Raise the last exception after max retries
                print(f"Invoke failed (attempt {attempt}/{max_retries}), retrying...")


def watsonx_chat_model(
    model_id="mistralai/mistral-medium-2505",
    max_new_tokens=500,
    temperature=0,
    top_p=0.1,
    frequency_penalty=0,
    presence_penalty=0,
    watsonx_apikey=os.getenv("WATSONX_APIKEY"),
    watsonx_project_id=os.getenv("WATSONX_PROJECT_ID"),
    watsonx_url=os.getenv("WATSONX_URL"),
):
    if not all([watsonx_apikey, watsonx_project_id, watsonx_url]):
        raise ValueError(
            "WATSONX_APIKEY, WATSONX_PROJECT_ID, and WATSONX_URL are required for watsonx.ai. "
            "Either set them as environment variables or provide them during initialization."
        )
    params = {
        ChatParams.MAX_TOKENS: max_new_tokens,
        ChatParams.TEMPERATURE: temperature,
        ChatParams.TOP_P: top_p,
        ChatParams.FREQUENCY_PENALTY: frequency_penalty,
        ChatParams.PRESENCE_PENALTY: presence_penalty
    }
    watsonx_llm = ChatWatsonxWithRetry(
        model_id=model_id,
        apikey=watsonx_apikey,
        url=watsonx_url,
        project_id=watsonx_project_id,
        params=params,
    )
    return watsonx_llm
