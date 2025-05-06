from deepeval.models.base_model import DeepEvalBaseLLM

class IBMWatsonxLLM(DeepEvalBaseLLM):
    """Class to implement IBMWatsonx for DeepEval"""
    def __init__(self, model):
        self.model = model

    def load_model(self):
        return self.model

    def generate(self, prompt: str) -> str:
        wx_model = self.load_model()
        res = wx_model.invoke(prompt)
        # res = wx_model.generate(promts=[prompt])
        print(f"In IBMWatsonx.generate, {res}\n\n")
        return res

    async def a_generate(self, prompt: str) -> str:
        wx_model = self.load_model()
        res = await wx_model.ainvoke(prompt)
        print(f"In IBMWatsonx.a_generate, {res}\n\n")
        return res

    def get_model_name(self):
        return "IBMWatsonx Model"
