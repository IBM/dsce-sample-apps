import os
import base64
from io import BytesIO
from typing import Any, Dict, List, Optional, Union, Iterator

from PIL.ImageFile import ImageFile

from services.watsonx import watsonx_chat_model
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, AnyMessage, BaseMessageChunk


class ChatWithImage:
    """
    ChatWithImage wraps a vision LLM to allow a user to chat with an LLM that accepts an image and text,
    with session-based chat history. It enforces that upto 5 images are allowed per session and that a system message
    can only be set at the beginning of a session.
    """

    def __init__(
        self,
        model_id: str = "meta-llama/llama-4-maverick-17b-128e-instruct-fp8",
        max_tokens: int = 2000,
        temperature: float = 0,
        top_p: float = 1
    ) -> None:
        """
        Initialize the ChatWithImage instance.

        :param model_id: The model ID to be used.
        :param max_tokens: Maximum tokens for the response.
        :param temperature: Temperature for generation.
        :param top_p: Top-p sampling value.
        """
        self._llm = watsonx_chat_model(
            model_id=model_id,
            max_new_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p
        )
        # Dictionary to store session histories.
        # Each session_id maps to a dict with:
        #   - "history": list of messages (both user and assistant)
        #   - "num_images": count of images that has been sent already.
        self.chat_sessions: Dict[str, Dict[str, Any]] = {}

    def __get_message(
        self,
        image_base64: List[str],
        prompt_text: str,
        system_message: str = ""
    ) -> List[Union[SystemMessage, HumanMessage]]:
        """
        Build a message list with the given image and prompt text.
        If a system message is provided, it is prepended to the message list.

        :param image_base64: List of Base64 encoded image strings (or [] if no image is provided).
        :param prompt_text: The text prompt.
        :param system_message: An optional system message.
        :return: A list of messages (SystemMessage and HumanMessage).
        """
        content: List[Dict[str, str]] = [{"type": "text", "text": prompt_text}]
        if image_base64:
            for im_base64 in image_base64:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": im_base64}
                })
        message = HumanMessage(content=content)
        if system_message:
            sys_message = SystemMessage(content=system_message)
            return [sys_message, message]
        return [message]

    def __load_image(self, path: str) -> str:
        """
        Load an image from the given file path and return its base64 encoded string.

        :param path: File path to the image.
        :return: Base64 encoded string of the image.
        """
        with open(path, "rb") as image_file:
            image = base64.b64encode(image_file.read())
            return image.decode("utf-8")

    def encode_image_to_base64(self, image: Union[str, ImageFile]) -> str:
        """
        Convert an image (filepath or PIL ImageFile) to a base64 encoded string.

        :param image: The image to convert.
        :return: Base64 encoded image string.
        """
        if isinstance(image, str):
            return self.__load_image(image)
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        image_bytes = buffered.getvalue()
        image_base64 = base64.b64encode(image_bytes)
        return image_base64.decode("utf-8")
    
    def save_and_yield_tokens(
        self,
        token_generator: Iterator[BaseMessageChunk],
        history: List[AnyMessage]
    ) -> Iterator[BaseMessageChunk]:
        """
        Iterate over a token generator from the LLM, accumulate the tokens into a single assistant response,
        update the latest assistant message in the chat history, and yield each token.

        This method creates an empty AIMessage and appends it to the history. As tokens are received,
        it updates the AIMessage's content with the cumulative text.

        :param token_generator: An iterator yielding tokens (BaseMessageChunk) from the LLM.
        :param history: The list representing the current chat history where the assistant message is stored.
        :yield: Each token (BaseMessageChunk) as it is received.
        """
        final_response = ""
        assistant_message = AIMessage(content="")
        history.append(assistant_message)
        for token in token_generator:
            final_response += token.content
            history[-1].content = final_response
            yield token

    def chat_with_image(
        self,
        prompt: str,
        images: List[Union[str, ImageFile]] = [],
        system_message: str = "",
        session_id: Optional[str] = None,
        stream: bool = False,
        convert_images_to_base64: bool = True,
    ) -> Union[str, Iterator[BaseMessageChunk]]:
        """
        Chat with the vision LLM.

        This method sends a prompt (with an optional image) to the LLM. When a session_id is provided,
        it maintains a conversation history across calls. The method enforces that:
          - A system message can only be set at the beginning of a session.
          - Upto five images is allowed per session.
        When streaming is enabled with a session_id, it yields tokens from the LLM as they arrive and updates the chat history.

        :param prompt: The text prompt.
        :param images: The image input (List of filepaths or PIL ImageFile). Pass [] if no image is to be provided.
        :param system_message: A system message to include. This can only be provided in the first message of a session.
        :param session_id: Optional session identifier for maintaining chat history.
        :param stream: If True, the response is streamed as tokens; otherwise, the full response is returned as a string.
        :param convert_images_to_base64: If True, converts the images to base64 encoding.
        :return: Either the full response content as a string (when not streaming) or an iterator yielding BaseMessageChunk tokens.
        :raises ValueError: If a system_message is provided after the first message in a session, or more than five images are provided in a session.
        """
        image_base64 = []
        if len(images) > 5:
            raise ValueError(f"Number of images({len(images)}) exceed the image limit. Upto 5 images are allowed.")
        if images:
            for image in images:
                if convert_images_to_base64:
                    image_format = "png"
                    if isinstance(image, str) and (image.lower().endswith("jpeg") or image.lower().endswith("jpg")):
                        image_format = "jpeg"
                    image_data = self.encode_image_to_base64(image)
                    image_base64.append(f"data:image/{image_format};base64,{image_data}")
                else:
                    image_base64.append(image)  # assume already base64 encoded

        # If no session_id is provided, operate statelessly.
        if session_id is None:
            messages = self.__get_message(image_base64, prompt, system_message=system_message)
            if stream:
                return self._llm.stream(messages)
            response = self._llm.invoke(messages)
            return response.content

        # Retrieve or create session state.
        session = self.chat_sessions.get(session_id, {
            "history": [],
            "num_images": 0,
        })
        self.chat_sessions[session_id] = session

        # Enforce that system_message can only be set at the beginning.
        if system_message:
            if session["history"]:
                raise ValueError("System message can only be set at the beginning of a session.")
            else:
                sys_msg = SystemMessage(content=system_message)
                session["history"].append(sys_msg)

        # Enforce that upto five images can be passed per session.
        if image_base64:
            if session["num_images"] + len(image_base64) > 5:
                raise ValueError("Image limit reached in this session. Upto 5 images are allowed.")
            else:
                session["num_images"] += len(image_base64)

        # Build the new user message (without re-including system message).
        new_messages = self.__get_message(image_base64, prompt, system_message="")
        # Append the new messages to the session history.
        session["history"].extend(new_messages)
        # Construct the full conversation history.
        conversation = session["history"]

        if stream:
            token_generator = self._llm.stream(conversation)
            # Return an iterator that yields tokens while updating the chat history.
            return self.save_and_yield_tokens(token_generator, session["history"])
        else:
            assistant_message = self._llm.invoke(conversation)
            session["history"].append(assistant_message)
            return assistant_message.content
        
    def get_chat_history(self, session_id: str) -> list:
        """
        Retrieve the chat history for a given session.

        Args:
            session_id (str): The session identifier.

        Returns:
            list: The chat history for the session. If no session exists, returns an empty list.
        """
        session = self.chat_sessions.get(session_id)
        if session:
            return session.get("history", [])
        return []

    def get_all_session_chat_history(self) -> dict:
        """
        Retrieve the chat histories for all sessions.

        Returns:
            dict: A dictionary mapping each session_id to its corresponding chat history list.
        """
        return {session_id: session.get("history", []) for session_id, session in self.chat_sessions.items()}

    def clear_session_history(self, session_id: str) -> None:
        """
        Clear the chat history for the given session_id.

        :param session_id: The identifier for the session whose history is to be cleared.
        """
        if session_id in self.chat_sessions:
            del self.chat_sessions[session_id]

    def clear_all_session_histories(self) -> None:
        """
        Clear the chat histories for all sessions.
        """
        self.chat_sessions.clear()
