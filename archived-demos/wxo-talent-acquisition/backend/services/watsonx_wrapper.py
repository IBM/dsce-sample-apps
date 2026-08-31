from ibm_watsonx_ai import Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.foundation_models.schema import (
    TextGenParameters,
)
import os
from dotenv import load_dotenv

class WatsonxWrapper:
    """
    A wrapper class for interacting with IBM WatsonX AI model inference.
    """

    def __init__(self, 
                 model_id: str = "meta-llama/llama-3-3-70b-instruct",
                 params: TextGenParameters = None):
        """
        Initializes the WatsonxWrapper.

        :param model_id: ID of the model to use for inference.
        :param params: Parameters for text generation. Defaults to predefined values.
        :raises ValueError: If required environment variables are missing.
        """
        load_dotenv()

        self.model_id = model_id

        # Load credentials securely
        watsonx_endpoint = os.getenv("WATSONX_ENDPOINT")
        api_key = os.getenv("IBM_CLOUD_API_KEY")
        if not watsonx_endpoint or not api_key:
            raise ValueError("Missing required environment variables: WATSONX_ENDPOINT or IBM_CLOUD_API_KEY.")

        self.credentials = Credentials(
            url=watsonx_endpoint,
            api_key=api_key
        )

        self.project_id = os.getenv("WATSONX_PROJECT_ID")
        if not self.project_id:
            raise ValueError("Project ID not found in environment variables.")

        # Set default parameters if not provided
        self.params = params or TextGenParameters(
            temperature=0,
            max_new_tokens=1000,
            random_seed=42,
            decoding_method='greedy',
            min_new_tokens=1
        )

        # Initialize the ModelInference instance
        self.model = ModelInference(
            model_id=self.model_id,
            credentials=self.credentials,
            project_id=self.project_id,
            params=self.params
        )

    def generate_text(self, prompt: str, params: TextGenParameters = None) -> str:
        if params:
            return self.model.generate_text(prompt=prompt, params=params)
        return self.model.generate_text(prompt=prompt, params=self.params)
    
    def generate_text_stream(self, prompt: str, params: TextGenParameters = None):
        if params:
            return self.model.generate_text_stream(prompt=prompt, params=params)
        return self.model.generate_text_stream(prompt=prompt, params=self.params)
    
    def generate_summary(self, prompt: str, clean: bool = True) -> str:
        """
        Generates a summary from the provided prompt using the Watsonx model.
        
        :param prompt: The input prompt to summarize.
        :param clean: If True, removes assistant prefix artifacts from the output.
        :return: A cleaned summary string.
        """
        try:
            result = self.generate_text(prompt)

            if clean:
                prefix = "assistant<|end_header_id|>\n\n"
                result = result.replace(prefix, "", 1).lstrip()

            return result

        except Exception as e:
            raise RuntimeError(f"Watsonx summary generation failed: {e}")

if __name__ == "__main__":
    wxw = WatsonxWrapper()
    print(wxw.generate_text("1+1"))
    for token in wxw.generate_text_stream("1+1"):
        print(token, end="")
