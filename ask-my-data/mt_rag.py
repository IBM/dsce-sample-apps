import os, base64, bcrypt, decimal, hashlib, json, requests, time, uuid
from flask import Flask, request, render_template, Response
from ibm_watson_machine_learning.foundation_models import Model
from ibm_watson_machine_learning.metanames import GenTextParamsMetaNames as GenParams
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.document_loaders import UnstructuredPDFLoader
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate
# vector store used for all tenants
from langchain_community.vectorstores import FAISS
import pandas as pd
import mysql.connector
from mysql.connector import pooling
from sql_formatter.core import format_sql
from dotenv import load_dotenv

load_dotenv()

# initialization 

WML_SERVER_URL=os.getenv("WML_SERVER_URL", default="https://us-south.ml.cloud.ibm.com")

# embedding model used for all tenants
embeddings = HuggingFaceEmbeddings(model_name = "sentence-transformers/all-MiniLM-L6-v2")

# For LLM call
SERVER_URL = os.getenv('SERVER_URL')
FOUNDATION_MODELS_URL = os.getenv('FOUNDATION_MODELS_URL')
WATSONX_PROJECT_ID = os.getenv('WATSONX_PROJECT_ID')
API_KEY = os.getenv("WATSONX_API_KEY", default="")
HEADERS = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'Authorization': 'Bearer {}'.format(API_KEY)
    }

APIAUTHCODE = os.getenv('APIAUTHCODE', default="wv29efrtsx95")

# env variable for watson assistant
WAINTEGRATIONID = os.getenv("WAINTEGRATIONID")
WAREGION = os.getenv("WAREGION")
WASERVICEINSTANCEID = os.getenv("WASERVICEINSTANCEID")

# Disable file hash checking. Allow any file to be uploaded.
FILE_LOCK_ENABLED = eval(os.getenv("FILE_LOCK_ENABLED", default="True"))

# per tenant data related to the vector index retrieval
stores = {} 	# vector index
retrievers = {}
chains = {}
chat_sessions = {}
users_data = {}
text_converted = {}
# the time when a vector store with a specific id was loaded so that it can cleared after a time limit
load_times = {}
current_label = {}
file_type = {}

# default prompts
all_prompts = ["label_classifier", "summarisation", "rag", "PII_extraction", "extraction", "generation", "code_gen", "classification"]

for i in all_prompts:
	with open('prompts/{}_prompt.txt'.format(i), 'r') as sample_prompt_f:
		users_data["default_{}_prompt".format(i)] = sample_prompt_f.read()

with open('payload/rag.json') as payload_f:
	payload_f_json = json.load(payload_f)
model_id = payload_f_json["model_id"]
decoding_method=payload_f_json["parameters"]["decoding_method"]
maximum_new_tokens = payload_f_json["parameters"]["max_new_tokens"]
minimum_new_tokens = payload_f_json["parameters"]["min_new_tokens"]
repetition_penalty = payload_f_json["parameters"]["repetition_penalty"]
stop_sequences = payload_f_json["parameters"]["stop_sequences"]
temperature = 0.5
top_k=50
top_p=0.5

rag_params = {
        GenParams.DECODING_METHOD:decoding_method,
        GenParams.MAX_NEW_TOKENS: maximum_new_tokens,
        GenParams.MIN_NEW_TOKENS: minimum_new_tokens,
        GenParams.TEMPERATURE: temperature,
        GenParams.TOP_K: top_k,
        GenParams.TOP_P: top_p,
        GenParams.REPETITION_PENALTY: repetition_penalty,
    }

model = Model(
    model_id=model_id,
    credentials={
        "apikey": API_KEY,
        "url": WML_SERVER_URL
    },
    project_id=WATSONX_PROJECT_ID,
    params=rag_params
    )
if(len(stop_sequences)>0):
	rag_params[GenParams.STOP_SEQUENCES] = stop_sequences


# API calls with tenant context

app = Flask(__name__)

# To store the hashes of the default files
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

default_pdf_hash = hash_file('static/default-files/resume-sample.pdf')
default_csv_hash = hash_file('static/default-files/hrdata.csv')

# For MySQL Connection
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")
DB_HOST = os.environ.get("DB_HOST")
DB_PORT = os.environ.get("DB_PORT")
DB_NAME = os.environ.get("DB_NAME")

# Get database connection
connection_pool = pooling.MySQLConnectionPool(pool_size=10, user=DB_USER, password=base64.b64decode(DB_PASS).decode("utf-8"), database=DB_NAME,
            host=DB_HOST, port=DB_PORT)

def getDBConnection():
    try:
        print('getting db connection')
        cnx = connection_pool.get_connection()
        print('db connection successful.')
        return cnx
    except mysql.connector.Error as err:
        print(f"Error while acquiring connection: {err}")

def executeSQLQuery(query):
	stopwords = [ "create", "drop", "alter", "truncate", "comment", "rename", "insert", "update", "delete", "lock",
		"call", "explain plan", "grant", "revoke", "commit", "rollback", "savepoint", "function", "procedure", "trigger"
	]
	for stopword in stopwords:
		query = query.replace(stopword, "")
	query = query.replace(";", "")
	print('query to execute:', query)
	try:
		db_cnx = getDBConnection()
		cursor = db_cnx.cursor(dictionary=True)
		cursor.execute(query)
		rows = cursor.fetchall()
		cursor.close()
		return rows
	except mysql.connector.Error as err:
		print(f"Error while executing query. Error: {err}")
		return "Unable to get answer, please retry with another query."
	finally:
		if 'db_cnx' in locals() and db_cnx.is_connected():
			db_cnx.close()
			print("Found an open db_cnx. Closed.")

# Create databse table, load data into table, create sql prompt file
def loadFromCsv(filepath, filename, id):
	data = pd.read_csv(filepath)
	df = pd.DataFrame(data)

	tablename = id.replace(".", "_")
	cols_script = ""
	for col in df.columns:
		cols = col.split("#")
		cols_script += f"{cols[0]} {cols[1]},"

	# creating prompt
	createSQLPrompt(tablename, df.columns, id)
	
	create_script = f"CREATE TABLE {tablename} ({cols_script[:-1]})"

	drop_script = f"DROP TABLE {tablename}"
	executeSQLQuery(drop_script)
	executeSQLQuery(create_script)

	# Insert DataFrame to Table
	cnx = getDBConnection()
	cursor = cnx.cursor()
	try:
		for row in df.itertuples(False):
			row_script = ''
			for x in row:
				row_script += "{},".format(str(x)) if isinstance(x, float) else f"'{x}'," 
			cursor.execute(f'''
				INSERT INTO {tablename}
				VALUES ({row_script[:-1]})
				'''
			)
		cnx.commit()
		cursor.close()
		cnx.close()

		print("Data loaded successfully")
	except mysql.connector.Error as err:
		cnx.rollback()
		cursor.close()
		cnx.close()
		print("Error in csv loading. Error:", err)
		return err

	return

# Create Sql gen prompt
def createSQLPrompt(tablename, attributes, id):
	# prompt = open("upload/{}_sqlprompt.txt".format(id), "w")
	prompt = f"Instruction:You are a developer writing SQL queries given natural language questions. The database contains a table. The schema of the table with description of the attributes is given. Write the SQL query given a natural language statement.\nHere is the table.\n\nDatabase Table Name: {tablename}\nTable Schema:\nColumn name # Meaning"
	# prompt.writelines(L)
	for col in attributes:
		fields = col.split('#')
		colname = fields[0].strip()
		coltype = fields[1].strip()
		coldesc = fields[2].strip()
		prompt += f"\n{colname} # {coldesc}"
    
	users_data[id]["sql_gen"]["prompt"] = prompt+"\n\nInput:\nwhat is average salary by position?\n\nOutput:\nselect position, avg(salary) as avg_salary from {} group by position order by avg_salary desc;".format(tablename)
	# prompt.close()

def fireSqlAndCreateTable(llm_result):

    # Execute query
	query_result = executeSQLQuery(llm_result)
	print("Query result: ",query_result)
	htmltable = ""
	if (type(query_result) == list and len(query_result) > 0):
		htmltable = "<table>"
		headers = query_result[0].keys()
		htmlheadtr = "<tr>"
		for heading in headers:
			htmlheadtr += "<td style='border: 1px solid black; padding:0.3rem; text-align: center;'><strong>{}</strong></td>".format(heading)
		htmlheadtr += "</tr>"

		htmltable += "{}".format(htmlheadtr)

		for row in query_result:
			v = row.values()
			htmltr = "<tr>"
			for i in v:
				if(isinstance(i,decimal.Decimal) or isinstance(i,float)):
					i = float(i)
					# if converted value doesn't contains any value other than 0 then convert to int
					if(i%1==0):
						i = int(i)
					i = round(i,2)
				htmltd = "<td style='border: 1px solid black; padding:0.3rem; text-align: center;'>{}</td>".format(i)
				htmltr += htmltd
			htmltr += "</tr>"
			htmltable += htmltr
		htmltable += "</table><br/>"
	elif (type(llm_result) == str and len(query_result) > 0):
		htmltable = query_result
	else:
		htmltable = "No results found"
	print("fireSqlAndCreateTable completed")
	return htmltable

# set default prompts to user id
def setDefaultPrompts(id):
	if id not in users_data:
		users_data[id] = dict(
					label_classifier={"prompt":users_data["default_label_classifier_prompt"]},
					rag={"prompt":users_data["default_rag_prompt"]},
					summarisation={"prompt":users_data["default_summarisation_prompt"]},
					PII_extraction={"prompt":users_data["default_PII_extraction_prompt"]},
					extraction={"prompt":users_data["default_extraction_prompt"]},
					generation={"prompt":users_data["default_generation_prompt"]},
					code_gen={"prompt":users_data["default_code_gen_prompt"]},
					classification={"prompt":users_data["default_classification_prompt"]}
				)
	dict_keys = users_data[id].keys()
	for ai_task in dict_keys:
		with open('payload/{}.json'.format(ai_task)) as payload_f:
				payload_f_json = json.load(payload_f)
		users_data[id][ai_task]["model_id"] = payload_f_json["model_id"]
		users_data[id][ai_task]["max_new_tokens"] = payload_f_json["parameters"]["max_new_tokens"]
		users_data[id][ai_task]["stop_sequences"] = payload_f_json["parameters"]["stop_sequences"]

# To load PDF/CSV file for a tenant with a specific id of the tenant
@app.route('/load/<id>', methods=["POST"])
def load_files(id):
	all_docs = []
	file = request.files['file1']
	split_tup = os.path.splitext(file.filename)
	unique_filename = uuid.uuid4().hex
	file_path = 'upload/{}{}'.format(unique_filename, split_tup[1])
	file.save(file_path)
	if(FILE_LOCK_ENABLED):
		file_hash_value = hash_file(file_path)
		if(file_hash_value!=default_csv_hash and file_hash_value!=default_pdf_hash):
			print("file not matched")
			msg = "Please upload from given files."
			if os.path.exists(file_path):
				os.remove(file_path)
			time.sleep(5)
			return {"ok": True, "file": "", "errMsg": msg}
	if(split_tup[1] == '.csv'):
		with open('payload/sql_gen.json') as payload_f:
			payload_f_json = json.load(payload_f)
		users_data[id]["sql_gen"] = {"prompt":"", "model_id":payload_f_json["model_id"], "max_new_tokens":payload_f_json["parameters"]["max_new_tokens"], "stop_sequences":payload_f_json["parameters"]["stop_sequences"]}
		current_label[id] = "sql_gen"
		msg = loadFromCsv(file_path, split_tup[0], id)
		stores[id] = "csv_file"
	else:
		loader = UnstructuredPDFLoader(file_path)
		documents = loader.load()
		text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
		texts = text_splitter.split_documents(documents)
		all_docs.extend(texts)
		print("Length: {}".format(len(texts)))

		# # load in vector index for tenant
		stores[id] = FAISS.from_documents(all_docs, embeddings)
		retrievers[id] = stores[id].as_retriever()
		current_label[id] = "rag"
		file = {'file': open(file_path, 'rb')}

		# create prompt
		prompt = users_data[id]["rag"]["prompt"]
		ll_prompt = PromptTemplate(template=prompt, input_variables=["context", "question"])
		chains[id] = ConversationalRetrievalChain.from_llm(model.to_langchain(), retrievers[id], combine_docs_chain_kwargs={"prompt": ll_prompt}, return_source_documents=True)
		chat_sessions[id] = []
		print(id, "vectordb loaded")

		# Store raw text content, this will be used for summary, etc.
		# You can use your own pdf to text generation service/logic as well instead of `documents[0].page_content`.
		text_converted[id] = documents[0].page_content
		msg="None"

	# collect uploaded file type into array
	file_type[id] = file_type.get(id) or []
	file_type[id].append(split_tup[1])
	uniq_file_types = set(file_type[id])

	# csv upload failed due to some error, remove from list.
	if(split_tup[1] == ".csv" and str(msg) != "None"):
		uniq_file_types.remove(split_tup[1])
	file_type[id] = list(uniq_file_types)

	if os.path.exists(file_path):
		os.remove(file_path)
	return {"ok": True, "file": split_tup[1], "errMsg": str(msg)}

# Get IBM access token and return headers
def get_header_with_access_tkn(access_token):
    headers_with_access_tkn = HEADERS.copy()
    headers_with_access_tkn['Authorization'] = 'Bearer {}'.format(access_token)
    return headers_with_access_tkn

# llm call to identify type of question asked
def find_label(text, id):
	authenticator = IAMAuthenticator(API_KEY)
	access_token = authenticator.token_manager.get_token()
	with open('payload/label_classifier.json') as payload_f:
		payload_f_json = json.load(payload_f)
	payload_f_json['project_id'] = WATSONX_PROJECT_ID
	payload_f_json['input'] = users_data[id]["label_classifier"]["prompt"]+text+"\nOutput:"
	response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_f_json))
	response_llm_json = response_llm.json()
	return response_llm_json['results'][0]['generated_text']

# call to rag
def answer_from_rag(id, q):
	q = q + ". Answer the question only from the given context."
	chain = chains[id]
	chat_history = chat_sessions[id]
	try:
		r = chain({"question": q, "chat_history": chat_history})
	except Exception as e:
		print("Error generated : ",e)
	# chat_sessions[id] = [(q, r['answer'])]
	answer = "<html><b>Question:</b>" + q + "<br><br>" + r['answer'] + "</html>"
	print("answer", answer)
	return r

# llm call
def llm_call(id,q,type):
	custom_example=False
	with open('payload/{}.json'.format(type)) as payload_f:
		payload_f_json = json.load(payload_f)
	authenticator = IAMAuthenticator(API_KEY)
	access_token = authenticator.token_manager.get_token()
	prompt_file = users_data[id][type]["prompt"]
	
	if(prompt_file.count("Input:") != prompt_file.count("Output:")):
		return "Input and Output must be in pair"
	
	li1 = prompt_file.split("Instruction:")
	li2 = li1[1].split("Input:")
	instruction = li2[0].strip()
	
	if(len(li2)>1 and "Output:" in li2[1]):
		li3 = li2[1].split("Output:")
		# checking if inout or output is not empty or if there are more than 1 input output pairs
		if(li3[0].strip()!="" or li3[1].strip()!="" or prompt_file.count("Input:")>1):
			custom_example=True
	
	input_prompt = instruction if len(instruction)!=0 else q
	print("Input_prompt : ",input_prompt)
	payload_f_json["project_id"] = WATSONX_PROJECT_ID
	payload_f_json["model_id"] = users_data[id][type]["model_id"]
	payload_f_json["parameters"]["max_new_tokens"] = int(users_data[id][type]["max_new_tokens"])
	payload_f_json["parameters"]["stop_sequences"] = users_data[id][type]["stop_sequences"]
	if(custom_example==False):
		payload_f_json["input"] = input_prompt+"\n\nInput:\n"+(text_converted[id] if (type!="sql_gen") else q)+"\n\nOutput:\n"
	else:
		payload_f_json["input"] = input_prompt+"\n\n"+prompt_file[prompt_file.find('Input:'):]+"\n\nInput:\n"+(text_converted[id] if (type!="sql_gen") else q)+"\n\nOutput:\n"
	
	print("Payload input : ",payload_f_json)
	response_llm = requests.post(SERVER_URL, headers=get_header_with_access_tkn(access_token), data=json.dumps(payload_f_json))
	response_llm_json = response_llm.json()
	stop_sequences = users_data[id][type]["stop_sequences"]
	res = response_llm_json['results'][0]['generated_text']
	for word in stop_sequences:
		res=res.lower().replace(word.lower(), "").strip()
	return res

# Server the webapp on / endpoint
@app.route('/')
def serve_index_page():
	return render_template('index.html', wa_integration_id=WAINTEGRATIONID, wa_region=WAREGION, wa_service_instance_id=WASERVICEINSTANCEID, api_a_code=APIAUTHCODE)

# User authentication based on email-id
@app.route('/verify_user', methods=["POST"])
def verify_user():
	data = request.json
	email = data["email"]
	
	# User verification logic - Start

	verified = True # True - if verification is passed, False - if verification failed
	
	# User verification logic - End

	id = email.split("@")[0]
	if verified:
		setDefaultPrompts(id)
	uploaded_file_types = file_type.get(id)
	response_data = {"status": "verified" if verified else "not verified", "doc_status": "_available" if uploaded_file_types and len(uploaded_file_types) > 0 else "not_available", "file_types":uploaded_file_types}
	return response_data

# Fetch user specific prompt
@app.route('/get-prompt/<id>/<ai_task>')
def get_prompt(id, ai_task):
	try:
		type = current_label[id] if ai_task=="none" else ai_task
		return {"data":users_data[id][type],"type": type, "ok":True}
		# return {"prompt":users_data[id][type]["prompt"],"model_id":users_data[id][type]["model_id"],"max_new_tokens":users_data[id][type]["max_new_tokens"], "stop_sequences": users_data[id][type]["stop_sequences"],"type": type, "ok":True}
	except:
		return {"data":"No data available", "type": type, "ok":True}

# Update/Set prompt in the user's data 
@app.route('/update-prompt/<id>', methods=["PUT"])
def update_prompt(id):
	data = request.json
	type = data["ai_task"]  #current_label[id]
	users_data[id][type]["prompt"] = data["new_prompt"]
	users_data[id][type]["model_id"] = data["model_id"]
	users_data[id][type]["max_new_tokens"] = int(data["max_new_tokens"])
	users_data[id][type]["stop_sequences"] = data["stop_sequences"]

	if(type=="rag"):
		rag_params[GenParams.MAX_NEW_TOKENS] = int(data["max_new_tokens"])
		if(len(data["stop_sequences"])>0):
			rag_params[GenParams.STOP_SEQUENCES] = data["stop_sequences"]

		model = Model(
			model_id=data["model_id"],
			credentials={
				"apikey": API_KEY,
				"url": WML_SERVER_URL
			},
			project_id=WATSONX_PROJECT_ID,
			params=rag_params
		)

		ll_prompt = PromptTemplate(template=data["new_prompt"], input_variables=["context", "question"])
		chains[id] = ConversationalRetrievalChain.from_llm(model.to_langchain(), retrievers[id], combine_docs_chain_kwargs={"prompt": ll_prompt}, return_source_documents=True)
		
	
	return {"resp":"Prompt updated", "ok":True}

# Invoke LLM API
@app.route('/query', methods=["POST"])
def get_answer():
	try:
		data = request.json
		id, question, question_type = data["userId"], data["question"], data["question_type"]
		print(id, question, question_type)

		label = None
		if (question_type == "csv" and "sql_gen" in users_data[id]):
			llm_query = llm_call(id, question, "sql_gen")
			# llm_query = llm_query.replace(";","").strip()
			print("Generated SQL query : ",llm_query)
			htmltable = fireSqlAndCreateTable(llm_query)
			current_label[id] = "sql_gen"
			return {"ok":True, "ans":htmltable, "source": format_sql(llm_query) if len(llm_query)>0 else ""}	

		if(question.strip()[:2]=="Q:"):
			label = "rag"
		else:
			label = find_label(question, id)
			label = label.replace("label:","")
			label = label.strip().replace(" ","_")
		current_label[id] = label
		print("Question identifies as : ", label)
		source_document = ""
		if(label=="rag"):
			r = answer_from_rag(id, question)
			answer = r["answer"]
			for i, doc in enumerate(r["source_documents"]):
				source_document += "<strong><u>Source chunk {} :</u></strong><br/><p>{}</p><br/>".format(str(i+1), doc.page_content)
		else:
			answer = llm_call(id, question, label)
		
		return {"ok":True, "ans":answer, "source": source_document}
	except Exception as error:
		return {"ok":False, "ans":error, "source": None}

# Get all models avaialble in watsonx GA - dallas.
@app.route('/models-list', methods=["GET"])
def get_foundation_models():
	# Authorize request
	auth_code = request.headers.get('APIAUTHCODE')
	if(not isVerified(auth_code)):
		return Response("Forbidden", status=403)

	response = requests.get(FOUNDATION_MODELS_URL)
	models_dict = response.json()
	models = map(lambda r: dict(id=r["model_id"], label=r["label"]) ,models_dict["resources"])
	return list(models)

# Dummy endpoint to verify in-memory data
@app.route('/check-data/<id>')
def get_data(id):
	return dict(users_data = users_data, file_type=file_type, chains = list(chains.keys()), stores = list(stores.keys()))

def isVerified(auth_code):
    return auth_code==APIAUTHCODE

if __name__ == '__main__':
	SERVICE_PORT = os.getenv("SERVICE_PORT", default="8050")
	DEBUG_MODE = eval(os.getenv("DEBUG_MODE", default="False"))
	app.run(port=SERVICE_PORT, debug=DEBUG_MODE)