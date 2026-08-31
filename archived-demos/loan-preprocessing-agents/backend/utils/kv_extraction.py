from pdf2image import convert_from_path
from utils.chat_image import ChatWithImage
from langchain_core.output_parsers import JsonOutputParser

kv_extraction_system_prompt = """
You are a document processing agent.

Your task:
- Extract all key-value pairs from the provided document images.
- Return the results **only** in JSON format.

**Output format:**
```json
{
    "key1": "value1",
    "key2": "value2"
}
````

**Key naming rules:**

* Use the exact keys below for these fields:
  1. Full Name → `full_name`
  2. Date of Birth → `date_of_birth`
  3. Loan Type → `loan_type`
  4. Loan Amount → `loan_amount`
* For all other fields, create clear and descriptive keys based on the document text.
* All keys must be in lowercase with words separated by underscores.

**Additional requirements:**

* Loan Amount value should be integer.
* JSON must be **single-level** (no nested objects).
* Values must be accurate and taken directly from the document.
* Do not extract or include signatures in the JSON output.
* Do not include extra commentary or formatting outside the JSON.
* Ensure the JSON is valid, clean, and well-structured.
"""

def extract_key_value_pairs(image_client: ChatWithImage, filename: str):
    images = convert_from_path(filename, thread_count=24, dpi=300, grayscale=False)
    data = image_client.chat_with_image(prompt="Extract all data from these images", images=images, system_message=kv_extraction_system_prompt)
    kv_data = JsonOutputParser().parse(data)
    return kv_data