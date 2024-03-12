from ibm_watson_machine_learning.foundation_models import Model
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
import os
import PyPDF2
import random
import itertools
from io import StringIO
from langchain.chains import RetrievalQA
from langchain.retrievers import SVMRetriever
from langchain.chains import QAGenerationChain
from langchain.text_splitter import CharacterTextSplitter
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import HuggingFaceEmbeddings
from langchain.document_loaders import UnstructuredPDFLoader, OnlinePDFLoader, PyPDFLoader
from langchain.vectorstores import FAISS
from langchain.chains.question_answering import load_qa_chain
from langchain.chains import ConversationalRetrievalChain

from flask import Flask, request, render_template
from dotenv import load_dotenv

load_dotenv()

WAINTEGRATIONID = os.getenv("WAINTEGRATIONID")
WAREGION = os.getenv("WAREGION")
WASERVICEINSTANCEID = os.getenv("WASERVICEINSTANCEID")

# WD_API_KEY = os.getenv("WD_API_KEY")
# WD_SERVER_URL = os.getenv("WD_SERVER_URL")
# WD_PROJECT_ID = os.getenv("WD_PROJECT_ID")

AI_API_KEY = os.getenv("AI_API_KEY")
AI_URL = os.getenv("AI_URL")
AI_MODEL_ID = os.getenv("AI_MODEL_ID")
PROJECT_ID = os.getenv("PROJECT_ID")

chain = None

def init():
    global chain
    print('init started')
    # replace this with a UI based load from watsonx assistant
    pdf_file_path=("data/NYSE_RHT_2019.pdf")
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
    # from langchain.agents.agent_toolkits import create_retriever_tool
    # tool = create_retriever_tool(
    #     retriever,
    #     "search_finacial_report",
    #     "Searches and returns answers from financial report."
    # )

    # tools = [tool]
    # from langchain.agents.agent_toolkits import create_conversational_retrieval_agent


    decoding_method="greedy"
    maximum_new_tokens = 500
    minimum_new_tokens = 0
    repetition_penalty = 1.5
    temperature = 0.5
    top_k=50
    top_p=0.5

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
        "apikey": AI_API_KEY,
        "url": AI_URL
    },
    project_id=PROJECT_ID,
    params=params
    )


    chain = ConversationalRetrievalChain.from_llm(model.to_langchain(), retriever, return_source_documents=True)

    chat_history = []

    # init done at this point

init()

app = Flask(__name__)
@app.route('/refresh')
def refresh():
    chain = None
    init()
    print('refresh successful.')
    return dict(status="success")

@app.route('/question', methods=['POST'])
def get_answer():
    print("question body--> ", request.json)
    question = request.json['question']
    chat_history = request.json['chat_history']
    source_document = ""

    if chain is None:
        return "please call refresh api or restart server"

    if (question == "auto"):
        answer = ""

        q1 = "what is the IRS employer identification number for redhat? Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>IRS ID: </b>" + r["answer"] + "<br>"

        q1 = "what is the address of redhat ? Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>Address: </b>" + r["answer"] + "<br>"

        q1 = "what is the state of incorporation of redhat? Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>State of Incorporation: </b>" + r["answer"] + "<br>"

        q1 = "what are the number of employees in redhat? Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>#Employees: </b>" + r["answer"] + "<br>"

        q1 = "list the acquisitions made by redhat mentioned in the report. Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>Recent acquisitions: </b>" + r["answer"] + "<br>"

        q1 = "who are all the executive officers in redhat? Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>Executives: </b>" + r["answer"] + "<br>"

        q1 = "provide some details of the business model of redhat using 100 words. Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        answer = answer + "<b>Business model: </b>" + r["answer"] + "<br>"
    else:
        # one question at a time from the UI
        q1 = question + ".Answer the question only from the given context."
        r = chain({"question": q1, "chat_history": chat_history})
        
        answer = r['answer']
        source_document = "<strong>Question:</strong> {}<br/><br/>".format(question)
        for i, doc in enumerate(r["source_documents"]):
            source_document += "<strong><u>Source chunk {} : {}</u></strong><br/><p>{}</p><br/>".format(str(i+1), doc.metadata['source'].split('/')[-1], doc.page_content)

    print("answer--> ", r["answer"])

    return dict(answer = answer, chat_history = chat_history, source_document = source_document)

@app.route('/')
def index_page():
    return render_template('index.html', wa_integration_id=WAINTEGRATIONID, wa_region=WAREGION, wa_service_instance_id=WASERVICEINSTANCEID)

if __name__ == '__main__':
    SERVICE_PORT = os.getenv("SERVICE_PORT", default="8000")
    DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="False"))
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=DEBUG_MODE)