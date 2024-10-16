from dotenv import load_dotenv
import os, hashlib, uuid
import re
from langchain.chains import ConversationalRetrievalChain
from langchain.embeddings import HuggingFaceInstructEmbeddings
from langchain.docstore.document import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.document_loaders import PyPDFLoader
from langchain.chains.summarize import load_summarize_chain
from langchain.chat_models import ChatOpenAI
from genai.extensions.langchain import LangChainInterface
from ibm_watson_machine_learning.foundation_models import Model
from genai.schemas import GenerateParams
#from genai.model import Credentials, Model
from ibm_watson_machine_learning.foundation_models import Model
from ibm_watson_machine_learning.foundation_models.extensions.langchain import WatsonxLLM
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
from langchain.chains.question_answering import load_qa_chain


from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
cors = CORS(app)

load_dotenv()
chunk_size = 1000
chunk_overlap = 100

api_key = os.getenv("GENAI_KEY", None)
api_url = os.getenv("GENAI_API", None)
project_id = os.getenv("PROJECT_ID", None)

from langchain import PromptTemplate
from langchain.prompts.few_shot import FewShotPromptTemplate

def hash_file(fileName):
        h = hashlib.sha1()
        with open(fileName, "rb") as file:
                # Use file.read() to read the size of file
                # and read the file in small chunks
                # because we cannot read the large files.
                chunk = 0
                while chunk != b'':
                        chunk = file.read(1024)
                        h.update(chunk)
        # hexdigest() is of 160 bits
        return h.hexdigest()

breast_biopsy_hash = hash_file('static/default-files/breast-biopsy-bc.pdf')
kidney_stone_hash = hash_file('static/default-files/kidney-stone-ds-report.pdf')
prostate_report_hash = hash_file('static/default-files/prostate-report.pdf')

@app.route('/api/upload', methods=['POST'])
def upload_pdf():
    try:
        pdf_file = request.form.get('textData')
        file = request.files['file']
        print("CONTENT FETCHED ----- ", pdf_file)
        unique_filename = uuid.uuid4().hex
        file_path = 'upload/{}{}'.format(unique_filename, file.filename)
        file.save(file_path)
        pdf_file_hash = hash_file(file_path)
        if os.path.exists(file_path):
            os.remove(file_path)
        if(pdf_file_hash not in [breast_biopsy_hash, kidney_stone_hash, prostate_report_hash]):
            print("Hash not matched")
            return jsonify({'notSupported': "Please upload only from given report files"})
        #pdf_file = request.files['breast-biopsy-bc.pdf']
        # if pdf_file and pdf_file.filename.endswith('.pdf'):
        if pdf_file:
            # Process the PDF file (you can save it, perform further actions, etc.)
            # For now, let's just return a success response
            # loader = pdf_file
            data = pdf_file
            print("File recieved",pdf_file)
            # few Examples of input and output
            examples = [
                {
                    "docs": "\n\nDIAGNOSIS:\nBREAST, RIGHT 11:00, ULTRASOUND-GUIDED NEEDLE BIOPSY: INVASIVE\nLOBULAR CARCINOMA.\nNOTE: Dr. Kristen N. Vandewalker has reviewed this case and concurs. The results are\ngiven to Dr. Test on 3/24/16. ER, PR and HER-2/neu studies will be performed on the tissue and the\nresults will be reported separately.\nGROSS DESCRIPTION: PC:sas\nPlaced in formalin at 10:00 in a container labeled with the patient's name and \"RT\" are four tan to yellow to bright pink\ncores of fibrofatty tissue. The cores measure from 1.9 to 0.95 cm in length with an average diameter of 0.2 cm. The\nspecimen is filtered and entirely submitted between sponges one cassette.\nMICROSCOPIC DESCRIPTION:\nANATOMIC PATHOLOGY\nREPORT\n\n\nPatient: TEST, PATIENT Age: 68 (01/01/47) Pathology #: DPS-16-01234\nAcct#: Sex: FEMALE Epic:\n\nDoctor: Date Obtained: 03/23/2016\nDate Received: 03/23/2016\nTest Doctor\n1234 Test st\n\n\nSections show an invasive lobular carcinoma in a fibroelastotic background with focal LCIS. If the cores are\nrepresentative of the tumor then it is grade I (estimated SBR score 5). The tumor measures at least 0.8 cm in greatest",
                    "output": "The report is about a breast biopsy that was done on the right breast. It shows that the patient has an invasive lobular carcinoma. This means that the cancer cells have spread from the milk ducts into the surrounding tissues. The tumor measures at least 0.8 cm in greatest dimension."
                },
                {
                    "docs": "Lung Biopsy Pathology Report\n\nDescription: Lung, wedge biopsy right lower lobe and resection right upper lobe. Lymph node, biopsy level 2 and 4 and biopsy level 7 subcarinal. PET scan demonstrated a mass in the right upper lobe and also a mass in the right lower lobe, which were also identified by CT scan.\n\nA 48-year-old smoker found to have a right upper lobe mass on chest x-ray and is being evaluated for chest pain. PET scan demonstrated a mass in the right upper lobe and also a mass in the right lower lobe, which were also identified by CT scan. The lower lobe mass was approximately 1 cm in diameter and the upper lobe mass was 4 cm to 5 cm in diameter. The patient was referred for surgical treatment.\n\nSPECIMEN:\nA. Lung, wedge biopsy right lower lobe\nB. Lung, resection right upper lobe\nC. Lymph node, biopsy level 2 and 4\nD. Lymph node, biopsy level 7 subcarinal\n\nFINAL DIAGNOSIS:\nA. Wedge biopsy of right lower lobe showing: Adenocarcinoma, Grade 2, Measuring 1 cm in diameter with invasion of the overlying pleura and with free resection margin.\n\nB. Right upper lobe lung resection showing: Adenocarcinoma, grade 2, measuring 4 cm in diameter with invasion of the overlying pleura and with free bronchial margin. Two (2) hilar lymph nodes with no metastatic tumor.\nC. Lymph node biopsy at level 2 and 4 showing seven (7) lymph nodes with anthracosis and no metastatic tumor.\nD. Lymph node biopsy, level 7 subcarinal showing (5) lymph nodes with anthracosis and no metastatic tumor.\n\nCOMMENT: The morphology of the tumor seen in both lobes is similar and we feel that the smaller tumor involving the right lower lobe is most likely secondary to transbronchial spread from the main tumor involving the right upper lobe. This suggestion is supported by the fact that no obvious vascular or lymphatic invasion is demonstrated and adjacent to the smaller tumor, there is isolated nests of tumor cells within the air spaces. Furthermore, immunoperoxidase stain for Ck-7, CK-20 and TTF are performed on both the right lower and right upper lobe nodule. The immunohistochemical results confirm the lung origin of both tumors and we feel that the tumor involving the right lower lobe is due to transbronchial spread from the larger tumor nodule involving the right upper lobe.",
                    "output": "A 48-year-old smoker found to have a right upper lobe mass on chest x-ray and is being evaluated for chest pain. PET scan demonstrated a mass in the right upper lobe and also a mass in the right lower lobe, which were also identified by CT scan. The lower lobe mass was approximately 1 cm in diameter and the upper lobe mass was 4 cm to 5 cm in diameter. The patient was referred for surgical treatment."
                },
                {
                    "docs": "IMPRESSION :\nHISTOPATHOLOGY TEST REPORT\nContainer 1 (appendix): Acute on chronic appendicitis (Fig 1) Container 2 (Fibroid): Leiomyoma with hyalinisation (Fig 2)\nGROSS\nReceived 2 containers\n1. Container : Received specimen of appendix with mesoappendix measuring 6.5cms in length. External surface is congested. Cut section : lumen noted & filled with fecolith. (1P)\n2. Container : Received 2 nodular whitish tissue fragments, largest measuring 3x2.5x2.5cms. Cut surface shows whitish whorled areas. (2P) (2-3)\nGROSSING DONE BY\nDr.Swapnika\nMICROSCOPY :\nContainer 1: Section studied from the appendix shows features of acute on chronic appendicitis with lymphoid follicular hyperplasia. Section is negative for granulomas or malignancy.\nContainer 2: Sections studied from the nodular mass show a tumor with features of leiomyoma with areas of hyalinisation. Sections are negative for granulomas or malignancy.",
                    "output": "The biopsy shows an inflammation of the appendix and a leiomyoma with hyalinisation. It is negative for malignancy. There were two containers which have different diagnoses. This means that the appendix shows signs of inflammation and infection, while the nodular mass appears to be a benign leiomyoma with some changes in the tissue. There are no indications of serious concerns like cancer or granulomas in either container."
                }
            ]
            # Define the prompt template
            template = """Summarize the paragraph, capturing meaningful insights, medical details, and explain the complex medical terms and shortening less important sentences.
            ".
            Input:
            {examples}
            Help me generate a summarised text to a patient for the below biopsy report::
            {data}
            Output:
            """
            # Create a PromptTemplate
            prompt_template = PromptTemplate(
                input_variables=["examples", "data"],
                template=template
            )
            # Generate the formatted prompt string
            formatted_prompt = prompt_template.format( examples=examples, data=data
            )
            #print(formatted_prompt)
            api_key = os.getenv("GENAI_KEY", None)
            api_url = os.getenv("GENAI_API", None)
            project_id = os.getenv("PROJECT_ID", None)
            #creds = Credentials(api_key, api_endpoint=api_url)
            creds = {
                    "url": api_url,
                    "apikey": api_key
                 }
            print("\n------------- Example (Model Talk)-------------\n")
            #params = GenerateParams(decoding_method="greedy", max_new_tokens=700, min_new_tokens=50, repetition_penalty=1.0)
            params = {
                GenParams.DECODING_METHOD: "greedy",
                GenParams.REPETITION_PENALTY: 1.0,
                GenParams.MIN_NEW_TOKENS: 50,
                GenParams.MAX_NEW_TOKENS: 700
            }
            #langchain_model = LangChainInterface(model="google/flan-ul2", params=params, credentials=creds)
            langchain_model = WatsonxLLM(model=Model(model_id="google/flan-ul2", params=params, credentials=creds, project_id=project_id))
            

            formulated_summary = langchain_model(formatted_prompt)
            print(formulated_summary)
            print("\n-----------------------------------------------\n")
            print(creds)
            print("Fetched " + str((data)) + " documents")
            return jsonify({'summary': formulated_summary})
        else:
            return jsonify({'error': 'Invalid file format.'}), 400
    #except Exception as e:
        #return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'Internal Server Error: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host ='0.0.0.0', port = 5000, debug = True)