# File to handle RAG pattern logic

import os, json
from ibm_watson_machine_learning.foundation_models import Model
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
from langchain.text_splitter import CharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.document_loaders import UnstructuredPDFLoader
from langchain.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain
from dotenv import load_dotenv

load_dotenv()

WATSONX_API_KEY = os.getenv("WATSONX_API_KEY")
WML_INSTANCE_URL = os.getenv("WML_INSTANCE_URL")
PROJECT_ID = os.getenv("WATSONX_PROJECT_ID")

chain = None

# Read & chunk pdf file into vectorstore
def init():
    global chain
    print('init started')
    with open('payload/rag-payload.json') as payload_f:
        payload_f_json = json.load(payload_f)

    AI_MODEL_ID = payload_f_json["model_id"]

    pdf_file_path=("data/hybrid-cloud-mesh-documentation.pdf")
    loader = UnstructuredPDFLoader(pdf_file_path)
    documents = loader.load()

    print('splitting texts')
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
    all_docs = []

    # can add multiple uploaded documents later
    texts = text_splitter.split_documents(documents)
    all_docs.extend(texts)
    print("Length: {}".format(len(texts)))

    embeddings = HuggingFaceEmbeddings(model_name = "sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.from_documents(all_docs, embeddings)
    print("vectordb loaded")

    retriever = db.as_retriever()
    decoding_method = payload_f_json['parameters']['decoding_method']
    maximum_new_tokens = payload_f_json['parameters']['max_new_tokens']
    minimum_new_tokens = payload_f_json['parameters']['min_new_tokens']
    repetition_penalty = payload_f_json['parameters']['repetition_penalty']
    temperature = payload_f_json['moderations']['hap']['temperature']
    top_k = payload_f_json['moderations']['hap']['top_k']
    top_p = payload_f_json['moderations']['hap']['top_p']

    # watsonx ai parameters for rag pattern
    params = {
        GenParams.DECODING_METHOD:decoding_method,
        GenParams.MAX_NEW_TOKENS: maximum_new_tokens,
        GenParams.MIN_NEW_TOKENS: minimum_new_tokens,
        GenParams.TEMPERATURE: temperature,
        GenParams.TOP_K: top_k,
        GenParams.TOP_P: top_p,
        GenParams.REPETITION_PENALTY: repetition_penalty
    }

    model = Model(
    model_id=AI_MODEL_ID,
    credentials={
        "apikey": WATSONX_API_KEY,
        "url": WML_INSTANCE_URL
    },
    project_id=PROJECT_ID,
    params=params
    )
    chain = ConversationalRetrievalChain.from_llm(model.to_langchain(), retriever, return_source_documents=True)
    print("You can proceed")

# Ask a question to LLM using rag pattern & get response
def generate_answer(question):
    source_document = ""
    chat_history = []
    if chain is None:
        return "please call refresh api or restart server"
    question = question.replace('_', ' ')
    q1 = question + " Answer the question only from the given document context."
    r = chain({"question": q1, "chat_history": chat_history})
    
    source_document = "<strong>Question:</strong> {}<br/><br/>".format(question)
    for i, doc in enumerate(r["source_documents"]):
        source_document += "<strong><u>Source chunk {} : {}</u></strong><br/><p>{}</p><br/>".format(str(i+1), doc.metadata['source'].split('/')[-1], doc.page_content)

    print("answer--> ", r["answer"])

    return dict(answer = r["answer"], chat_history = chat_history, source_document = source_document)