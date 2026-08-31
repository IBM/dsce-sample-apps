import os, requests, json, jmespath
import streamlit as st
from functools import reduce
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
   page_title="Switch GenAI platform - App",
   layout="wide",
   initial_sidebar_state="expanded",
)

st.title('Switch GenAI platform - App')

FRAMEWORK_SERVER_URL = os.getenv("FRAMEWORK_SERVER_URL")
FRAMEWORK_APIAUTHCODE = os.getenv("APIAUTHCODE")

if not FRAMEWORK_APIAUTHCODE:
    # Get user auth code
    FRAMEWORK_APIAUTHCODE = st.sidebar.text_input(":blue[Enter auth code :key:]", type="password", help="Auth code for accessing framework APIs")
    ":arrow_left: Provide your auth code to get started with the app."

FRAMEWORK_HEADER = {
    "APIAUTHCODE": FRAMEWORK_APIAUTHCODE
}

# /get-providers api call
response = requests.get(f"{FRAMEWORK_SERVER_URL}/get-providers/all", headers=FRAMEWORK_HEADER)

# /get-tags api call
def get_tags(provider, aiTask):
    api_payload = {
        "provider": provider,
        "aiTask": aiTask
    }
    response = requests.post(f"{FRAMEWORK_SERVER_URL}/get-tags", headers=FRAMEWORK_HEADER, json=api_payload)
    return response.json()

# /find-prompt api call
def find_prompt(provider, searchTags):
    api_payload = {
        "provider": provider,
        "search": list(set(searchTags))
    }
    st.markdown(":blue[Body for finding prompt:]")
    st.code(api_payload, "json")
    response = requests.post(f"{FRAMEWORK_SERVER_URL}/find-prompt", headers=FRAMEWORK_HEADER, json=api_payload)
    return response.json()

# /get-examples api call
def get_examples(provider, searchTags):
    api_payload = {
        "provider": provider,
        "search": list(set(searchTags))
    }
    # st.markdown(":blue[Body for finding examples:]")
    # st.code(api_payload, "json")
    response = requests.post(f"{FRAMEWORK_SERVER_URL}/get-examples", headers=FRAMEWORK_HEADER, json=api_payload)
    return response.text

# /update-examples api call
def update_examples(provider, searchTags, example_text):
    api_payload = {
        "provider": provider,
        "search": list(set(searchTags)),
        "text": example_text
    }
    # st.markdown(":blue[Body for updating examples:]")
    # st.code(api_payload, "json")
    response = requests.post(f"{FRAMEWORK_SERVER_URL}/update-examples", headers=FRAMEWORK_HEADER, json=api_payload)
    return response.text

# /find-execute-prompt api call
def find_and_execute(provider, searchTags, example_text):
    api_payload = {
        "provider": provider,
        "search": list(set(searchTags)),
        "input_text": example_text
    }
    # st.markdown(":blue[Body for execute llm api:]")
    # st.code(api_payload, "json")
    response = requests.post(f"{FRAMEWORK_SERVER_URL}/find-execute-prompt", headers=FRAMEWORK_HEADER, json=api_payload)
    return response.text


# Streamlit UI


if not FRAMEWORK_APIAUTHCODE:
    st.stop()
if response.status_code != 200:
    st.error("Invalid auth key!", icon="🚨")
    st.stop()

st.subheader("Finding Providers & AI task")
col1, col2, col3 = st.columns([1,1,2])

prov_json = response.json()
# Create provider wise ai tasks dict
provider_wise_tasks = {value: [key for key, values in prov_json.items() if value in values] for value in set(sum(prov_json.values(), []))}

user_selected_aiTask = None
user_selected_tags = None
prompts = None
with col1:
    p = jmespath.search("*", prov_json)
    providers = list(set(reduce(lambda x,y: x+y, p)))
    providers.sort(reverse=True)

    # Providers selection
    user_selected_provider = st.radio(":blue[Choose provider:]", providers, index=None, horizontal=True)
    if user_selected_provider:
        # AI task selection
        user_selected_aiTask = st.radio(":blue[Choose AI task:]", provider_wise_tasks[user_selected_provider], index=None)

with col2:
    if user_selected_aiTask:
        tags = get_tags(user_selected_provider, user_selected_aiTask)
        # Tags selection
        user_selected_tags = st.multiselect(":blue[Choose multiple search tags:]", tags, placeholder="Choose search tags")

with col3:
    if user_selected_tags:
        search_list = user_selected_tags + [user_selected_aiTask]
        prompts = find_prompt(user_selected_provider, search_list)
        # Prompts view
        st.markdown(":blue[Prompts found:]")
        with st.container(height=300):
            st.json(prompts, expanded=False)

if prompts and len(prompts) == 1:
    st.divider()
    st.subheader("Editing the prompt")
    e_col1, e_col2 = st.columns(2)
    with e_col1:
        examples = get_examples(user_selected_provider, search_list)
        # Examples text area
        user_input_examples = st.text_area(":blue[Examples availabe in a prompt:]", examples, height=350)
        # Update examples button
        update_button_clicked = st.button("Update examples", type="primary", use_container_width=True)
        if update_button_clicked:
            ex_message = update_examples(user_selected_provider, search_list, user_input_examples)
            if ex_message == 'Examples set successfully.':
                st.success(ex_message, icon="✅")
            else:
                st.warning(ex_message, icon="⚠️")

    with e_col2:
        # Full Prompt text area
        st.text_area(":blue[Raw prompt:]", json.dumps(prompts[0], indent=4), height=350)
        # Update examples button
        st.button("Update prompt", type="primary", use_container_width=True, disabled=True)
    
    st.divider()
    st.subheader("Execute the LLM API")
    exe_col1, exe_col2 = st.columns(2)

    with exe_col1:
        # Input text area
        user_input_text = st.text_area(":blue[Input:]", height=450)
        # Execute llm api button
        execute_button_clicked = st.button("Execute inference api", type="primary", use_container_width=True)
    
    with exe_col2:
        st.markdown(":blue[Output/Response from LLM:]")
        with st.container(height=550):
            if execute_button_clicked:
                with st.spinner("Please wait..."):
                    ex_message = find_and_execute(user_selected_provider, search_list, user_input_text)
                    st.json(ex_message)