import { Component, OnDestroy, OnInit, AfterViewInit, TemplateRef, ViewChild, ChangeDetectorRef, ViewChildren, QueryList, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators , FormControl} from '@angular/forms';
import { select, Store } from '@ngrx/store';
import { firstValueFrom, lastValueFrom, Observable, of, Subject } from 'rxjs';
import { currentUser, User } from '../../core/auth';
import { AppState } from '../../core/reducers';
import { LLMParams } from '../../models/llm-params.model';
import { LLMPayload } from '../../models/llm-payload.model';
import { Audit, RagConfig, LoadersEnum, TextSplitterEnum, VectorDBEnum, EmbeddingModelEnum } from '../../models/rag_config.model';
import { CommonService, LLMService } from '../../services';
import  * as demo_data from '../../../assets/mock/demo_data.json';
import * as wx_llm_specs from '../../../assets/mock/wx_llm_specs.json';
import { PerformanceComponent } from './metrics/performance/performance.component';
import { AlertModalType, ModalButtonType, ModalService } from 'carbon-components-angular';
import { GenerateComponent } from './generate/generate.component';
import { MetricsComponent } from './metrics/accuracy/metrics.component';
import { io } from "socket.io-client";
// import { Socket } from 'ngx-socket-io';
import { environment } from 'src/environments/environment';

import { WebSocketService } from '../../services/web-socket.service';

export enum PageContent {
	QnA = 'QnA',
	SUMMARIZATION = 'SUMMARIZATION',
	EXTRACTION = 'EXTRACTION',
	CLASSIFICATION = 'CLASSIFICATION',
	GENERATION = 'GENERATION'
  }

@Component({
	selector: 'comparison',
	templateUrl: './comparison.component.html',
	styleUrls: ['./comparison.component.scss'],
	// encapsulation: ViewEncapsulation.None
})
export class ComparisonComponent implements OnInit, AfterViewInit, OnDestroy {

	chart: any;
	testChart: any;

	user$: Observable<User>;
	loggedInUser: any
	isAdmin: boolean = false;
	offset =  { x: -118, y: 49 };
	showContent: PageContent = PageContent.QnA;

	demoData: any = demo_data;
	wxLLMSpecs: any = wx_llm_specs;
	defaultQuestions: any;
	referenceText: string;

	DEFAULT_COLLECTION = "";
	collections = [];
	llmSpecs: any;
	externalLLMSpecs: any;
	selectedLLM1: any;
	selectedLLM2: any;
	selectedQuestion: any;
	selectedVectorDB: any;
	selectedCollection: any;
	doc_path: string;
	collection_name: string;
	selectedFileName: string | null = null;

	llmForm: FormGroup;
	hasllmFormErrors: boolean = false;
	externalLLMConfigForm: FormGroup;
	hasExternalLLMConfigFormErrors: boolean = false;
	ragForm: FormGroup;
	hasRagFormErrors: boolean = false;

	llmPayload: LLMPayload;
	externalLLMConfig: any = {};
	llm1Response: any;
	llm2Response: any;
	evaluationMetrics: any;
	sourceNodes: any;

	// generateAPICalled: boolean = false;
	showSettings: boolean = false;
	showPerformanceGraph: boolean = false;

	replace_checked: boolean = true;
	vectordb_checked: boolean = true;
	llm_param_decoding: boolean = false;
	enable_rag_checked: boolean = false;
	openRefTextModal: boolean = false;
	openExtLLMConfModal: boolean = false;
	openLoadDocsModal: boolean = false;
	openDeleteCollectionModal: boolean = false;
	addedFiles: any = [];
	showUploader: boolean = true;

	loaders: any = {
		"loading_page": false,
		"fetch_context": false,
		"generate_llm1_response": false,
		"generate_llm2_response": false,
		"load_documents": false,
		"metrics": {
			"rouge": false,
			"bleu": false,
			"perplexity": false,
			"llm_as_judge": false
		}
	}

	notificationObj: any;
	costConfig: any = {
		perDayAPICalls: 1000
	}

	promptCols = 100;
	promptRows = 2;

	platforms: any = ["watsonx", "external"];
	selectedPlatform: string = "watsonx";
	// defaultPrompt = "<|user|>\nAnswer the following question using only information from the article.  If there is no good answer in the article, say \"I don't know\"\n\n[Document]\n{context}\n[End]\n\n{question}\n\n<|assistant|>\n";
	// defaultPrompt =  "{context}\n\nINSTRUCTIONS:\nAnswer the following question using only information from the documents given above. If there is no good answer in the given documents, say \"I don't know\"\n\nUSER:\n{query}\n\nASSISTANT:\n",
	// defaultPrompt = "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\nYou always answer the questions with markdown formatting. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.\n\nAny HTML tags must be wrapped in block quotes, for example ```<html>```. You will be penalized for not rendering code in block quotes.\n\nWhen returning code blocks, specify language.\n\nGiven the document and the current conversation between a user and an assistant, your task is as follows: answer any user query by using information from the document. Always answer as helpfully as possible, while being safe. When the question cannot be answered using the context or document, output the following response: \"I cannot answer that question based on the provided document.\".\n\nYour answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{context}\n<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{question}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n";
	defaultPrompt = "{context}\n\nINSTRUCTIONS:\n\n1: You always answer the questions with markdown formatting. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.\n\n2: Any HTML tags must be wrapped in block quotes, for example ```<html>```. You will be penalized for not rendering code in block quotes.\n\n3: When returning code blocks, specify language.\n\n4: Given the document and the current conversation between a user and an assistant, your task is as follows: answer any user query by using information from the document. Always answer as helpfully as possible, while being safe. When the question cannot be answered using the context or document, output the following response: \"I cannot answer that question based on the provided document.\".\n\n5: Your answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\n6: If a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.\"\n\nQuestion: {query}\n\nAnswer:\n"

	// MARKER_COLOR: any = {"GREEN": "#8aa1f2", "ORANGE": "#f6907b"};
	MARKER_COLOR: any = {"GREEN": "LightSeaGreen", "ORANGE": "RoyalBlue"};

	chunk_size_label = "Chunk Size";
	chunk_overlap_label = "Chunk Overlap";

	ragConfig: RagConfig;
	LOADERS: any = Object.keys(LoadersEnum)
					.map(key => ({ id: LoadersEnum[key], content: key }));

	EMBEDDING_MODELS: any = Object.keys(EmbeddingModelEnum)
	.map(key => ({ id: EmbeddingModelEnum[key], content: key }));


	TEXT_SPLITTERS: any = Object.keys(TextSplitterEnum)
							.map(key => ({ id: TextSplitterEnum[key], content: key }));

	VECTORDBS: any = [
		{id: VectorDBEnum.IN_MEMORY, content: VectorDBEnum.IN_MEMORY},
		{id: VectorDBEnum.MILVUSDB, content: VectorDBEnum.MILVUSDB}
		];

	METRICS: any = {
		rouge: true,
		bleu: true,
		perplexity: false,
		llm_as_judge: false
	}

	socket: any;

	headerEvents:Subject<any> = new Subject();

	// @ViewChildren("generateChild1")
    // public generateChild1: QueryList<GenerateComponent>
	// @ViewChildren("generateChild2")
    // public generateChild2: QueryList<GenerateComponent>
	// @ViewChildren("performanceChild")
    // public performanceChild: QueryList<PerformanceComponent>

	@ViewChild('performanceChild', { static: false }) private performanceChild : PerformanceComponent;
	@ViewChild('generateChild1', { static: false }) private generateChild1 : GenerateComponent;
	@ViewChild('generateChild2', { static: false }) private generateChild2 : GenerateComponent;
	@ViewChild('evaluationsChild', { static: false }) private evaluationsChild : MetricsComponent;

	// @ViewChildren('performanceChild') private performanceChild : PerformanceComponent;
	// @ViewChildren('generateChild1') private generateChild1 : GenerateComponent;
	// @ViewChildren('generateChild2') private generateChild2 : GenerateComponent;

	constructor(
		private store: Store<AppState>,
		private llmService: LLMService,
		private llmFB: FormBuilder,
		private externalLLMConfigFB: FormBuilder,
		private ragFB: FormBuilder,
		private commonService: CommonService,
		protected modalService: ModalService,
		private cdr: ChangeDetectorRef,
		private webSocketService: WebSocketService
	) {
		// this.cdr.detach();
	}

	async ngOnInit(): Promise<void> {
		this.user$ = this.store.pipe(select(currentUser));
		this.user$.subscribe(async u => {
			this.loggedInUser = u;
			if(this.loggedInUser && this.loggedInUser['roles'].includes('admin')){
				this.isAdmin = true;
				// this.LOADERS.push({id: LoadersEnum.LLMSherpaLoader, content: LoadersEnum.LLMSherpaLoader});
			}
			if(this.loggedInUser && this.loggedInUser.id){
				console.log('IN ComparisonComponent.ngOnInit >>>> ', this.loggedInUser);
				await this.initSocket();
			}
		});

		this.loaders["loading_page"] = true;
		await this.refreshWXToken();
		await this.fetchIBMLLMSpecs();
		await this.fetchCollections();

		await this.resetComparison();
		console.log("\n\n----------- ALL CONTENT LOADED --------- \n\n");
		this.loaders["loading_page"] = false;
		this.cdr.detectChanges(); // enable detectChanges here and you're done.
	}

	async ngAfterViewInit(): Promise<void> {
		let eventObj = {
			"leftPanelActive": false,
			"showLeftPanel": false
		}
		this.commonService.emitHeaderEvent(eventObj);
	}

	// async ngAfterContentInit(): Promise<void> {

	// }

	ngOnDestroy(): void {
		// console.log('IN ComparisonComponent.ngOnDestroy >>>> ');
		this.webSocketService.close();
	}

	async initSocket(){
		if(this.loggedInUser && this.loggedInUser.id){
			const WS_ENDPOINT = environment.BACKEND_API_URL + "/ws/"+this.loggedInUser.id
			console.log("IN initSocket.loggedInUser.id: ", this.loggedInUser.id, ", WS_ENDPOINT: ", WS_ENDPOINT);
			this.webSocketService.connect(this.loggedInUser.id, async (msg) => {
				console.log('Message received on Socket: >>>', msg);
				this.loaders["load_documents"] = false;
				let message = "";
				if ('message' in msg){
					message = msg['message'];
				}else{
					message = msg;
				}
				const notificationObj = {
					type: 'success',
					title: "Success: ",
					message: `${message}`,
					lowContrast: false,
					showClose: true
				}
				this.showNotification(notificationObj, false)
				await this.fetchCollections()
			});
		}
	}

	selectQuestionEvent(event){
		if(event.item){
			this.selectedQuestion = event.item;
			console.log("IN selectQuestionEvent: ",this.selectedQuestion);
			this.referenceText = this.selectedQuestion.expected_ans;
			let prompt = this.selectedQuestion.content;
			if(this.llmForm){
				this.llmForm.controls["inputTxt"].setValue(prompt);
			}
		}
	}

	closeModal(){
		console.log("in closeModal >>> ");
		this.openRefTextModal = false;
	}

	showRefTextModal(){
		console.log("in showRefTextModal >>> ");
		this.openRefTextModal = true;
	}

	async changeExpectedResponse(){
		console.log("IN changeExpectedResponse: >> ", this.referenceText);
		this.openRefTextModal = false;
	}

	showExtLLMConfModal(){
		console.log("in showExtLLMConfModal >>> ");
		this.createExternalLLMConfigForm();
		this.openExtLLMConfModal = true;
	}

	closeExtLLMConfModal(){
		console.log("in closeExtLLMConfModal >>> ");
		this.openExtLLMConfModal = false;
	}

	showLoadDocsModal(){
		console.log("in showLoadDocsModal >>> ");
		this.collection_name = this.ragForm.controls['collection_name'].value;
		this.openLoadDocsModal = true;
	}

	closeLoadDocsModal(){
		console.log("in closeLoadDocsModal >>> ");
		this.openLoadDocsModal = false;
	}

	showDeleteCollectionModal(){
		console.log("in showDeleteCollectionModal >>> ");
		this.collection_name = this.ragForm.controls['collection_name'].value;
		this.openDeleteCollectionModal = true;
	}

	closeDeleteCollectionModal(){
		console.log("in closeDeleteCollectionModal >>> ");
		this.openDeleteCollectionModal = false;
	}


	openNewTab(url){
		window.open(url, '_blank');
	}

	async retrieveContext(){
		const contexts = await this.fetchContext(this.llmForm.controls["inputTxt"].value, this.defaultPrompt);
		// this.cdr.detectChanges();
		if (this.generateChild1) {
			this.generateChild1.formatSourceNodes(this.sourceNodes);
		}

		if (this.generateChild2) {
			this.generateChild2.formatSourceNodes(this.sourceNodes);
		}

		return contexts
	}

	showNotification(notificationObj, close){
		this.notificationObj = notificationObj;

		if(close){
			setTimeout(() => {
				this.closeNotification();
			}, 5000);
		}
	}

	closeNotification(){
		this.notificationObj = null;
	}

	async platformChangeEvent(event){
		this.selectedPlatform = event.value;
		console.log("IN platformChangeEvent: >> ", event, this.selectedPlatform);
		if(this.selectedPlatform == "external"){
			console.log("externalLLMConfig: >> ", this.externalLLMConfig);
			if(this.externalLLMConfig && 'openai_api_key' in this.externalLLMConfig && this.externalLLMConfig['openai_api_key']){
				await this.fetchExternalLLMSpecs();
			}else{
				this.showExtLLMConfModal();
			}
		}else{
			if(this.llmSpecs && this.llmSpecs.length > 0){
				this.llmSpecs.forEach(llmSpec => {
					if(llmSpec.id == "meta-llama/llama-3-1-70b-instruct"){
						this.selectedLLM2 =  llmSpec;
					}
				});
				if (this.selectedLLM2 == undefined){
					this.selectedLLM2 =  this.llmSpecs[0]
				}
			}
		}
	}

	llm1Selected(event){
		if(event.item){
			console.log('llm1Selected: ', event.item);
			this.selectedLLM1 = event.item;
			// this.llm1Response = null;
		}
	}

	llm2Selected(event){
		if(event.item){
			console.log('llm2Selected: ', event.item);
			this.selectedLLM2 = event.item;
			// this.llm2Response = null;
		}
	}

	vectordbSelected(event){
		if(event.item){
			console.log("IN vectordbSelected: ", event.item);
			this.ragForm.controls["db_name"].setValue(event.item.content);
			this.selectedVectorDB = event.item.content;
		}

		this.fetchCollections()
	}

	embeddingModelSelected(event){
		if(event.item){
			// this.ragConfig.embedding = event.item;
			this.ragConfig.vectordb_config.embedding_model = event.item.id
			// this.ragConfig.collection_name = event.item;
			// this.llm2Response = null;
			console.log("IN embeddingModelSelected, vectordb_config ", this.ragConfig.vectordb_config);
		}
	}

	collectionSelected(event){
		if(event.item){
			console.log("IN collectionSelected: ", event.item, ", selectedVectorDB: ", this.selectedVectorDB);
			this.selectedCollection = event.item;
			// this.onFileSelect(event)
			this.ragForm.controls["collection_name"].setValue(event.item.content);
			if ("metadata" in event.item && "embedding_model" in event.item.metadata){
				this.ragConfig['vectordb_config']['embedding_model'] = event.item.metadata["embedding_model"];
				this.ragForm.controls["embedding_model"].setValue(event.item.metadata["embedding_model"]);
			}

			console.log(this.ragConfig['vectordb_config']['embedding_model'])
		}
		this.loadDefaultQuestions()
	}

	collectionSelectedForRAG(event){
		if(event.item){
			console.log("IN collectionSelected...: ", event.item, ", selectedVectorDB: ", this.selectedVectorDB);
			this.selectedCollection = event.item;
			// this.onFileSelect(event)
			// console.log("inside collected selected for rag ",this.selectedCollection)
			this.doc_path = `${environment.BACKEND_API_URL}/docs/${this.selectedVectorDB}/${event.item.content}`
			console.log(this.doc_path);
		}
		this.loadDefaultQuestions()

	}

	// collectionSelectedForRAG(event){
	// 	this.doc_path = "";
	// 	if(event.item){
	// 		this.selectedCollection = event.item;
	// 		console.log("IN collectionSelected1: ", event.item, ", selectedVectorDB: ", this.selectedVectorDB);
	// 		this.doc_path = `${environment.BACKEND_API_URL}/docs/${this.selectedVectorDB}/${event.item.content}`
	// 		console.log(this.doc_path);
	// 	}
	// 	this.loadDefaultQuestions()
	// }

	loaderSelected(event){
		if(event.item){
			console.log("IN loaderSelected: ", event.item.content )
			this.ragForm.get('chunk_size')?.disable();
			this.ragForm.get('chunk_overlap')?.disable();
			this.ragForm.get('chunk_separator')?.disable();
			if(event.item.content == LoadersEnum.IBMDoclingLoader){

				this.TEXT_SPLITTERS = Object.keys(TextSplitterEnum)
							.map(key => {
								if(key == TextSplitterEnum.HierarchicalNodeParser || key == TextSplitterEnum.CustomHierarchicalChunker){
									let splitter = ({ id: TextSplitterEnum[key], content: key })
									return splitter
								}else{
									return null;
								}
							}).filter(splitter => splitter);
			}else{
				this.TEXT_SPLITTERS = Object.keys(TextSplitterEnum)
							.map(key => {
								if(key != TextSplitterEnum.CustomHierarchicalChunker){
									let splitter = ({ id: TextSplitterEnum[key], content: key })
									return splitter
								}else{
									return null;
								}
							}).filter(splitter => splitter);
			}
		}
	}

	splitterSelected(event){
		if(event.item){
			console.log("IN splitterSelected: ", event.item.content )
			if(event.item.content == TextSplitterEnum.TokenTextSplitter || event.item.content == TextSplitterEnum.SentenceSplitter){
				this.ragForm.get('chunk_size')?.enable();
				this.ragForm.get('chunk_overlap')?.enable();
				this.ragForm.get('chunk_separator')?.enable();
			}else{
				this.ragForm.get('chunk_size')?.disable();
				this.ragForm.get('chunk_overlap')?.disable();
				this.ragForm.get('chunk_separator')?.disable();
			}

			if(event.item.content == TextSplitterEnum.CustomHierarchicalChunker){
				console.log("Selecting this parser takes 1-2 seconds for parsing each page of the document, but the accuracy of chunking will be better with this approach.")
				const notificationObj = {
					type: 'info',
					title: "Document Parsing/Chunking ",
					message: `Selecting this parser takes 1-2 seconds for parsing each page of the document, but the accuracy of chunking will be better with this approach.`,
					lowContrast: false,
					showClose: true
				}
				this.showNotification(notificationObj, false)
			}

		}
	}

	refreshBeforeGenerate(){
		this.llm1Response = null;
		this.llm2Response = null;
		this.evaluationMetrics = null;
		// this.generateAPICalled = false;
	}

	async refreshPage(){
		this.loaders["loading_page"] = true;
		await this.refreshWXToken();
		await this.fetchIBMLLMSpecs();
		await this.fetchCollections();

		await this.resetComparison();
		console.log("\n\n----------- ALL CONTENT LOADED --------- \n\n");
		this.loaders["loading_page"] = false;
		this.cdr.detectChanges(); // enable detectChanges here and you're done.
	}

	async resetComparison(){
		this.refreshBeforeGenerate();
		this.doc_path = null;
		this.selectedLLM1 = null;
		this.selectedLLM2 = null;
		this.referenceText = null;
		this.openLoadDocsModal = false;
		this.openDeleteCollectionModal = false;
		await this.createRagForm();
		this.resetSettings();

		if(this.llmSpecs && this.llmSpecs.length > 0){
			this.llmSpecs.forEach(llmSpec => {
				if(llmSpec.id == "ibm/granite-3-8b-instruct"){
					// this.selectedLLM1 = {...llmSpec};
					this.selectedLLM1 = llmSpec;
				}
				if(llmSpec.id == "meta-llama/llama-3-1-70b-instruct"){
					// this.selectedLLM2 =  {...llmSpec};
					this.selectedLLM2 =  llmSpec;
				}
			});
			if (this.selectedLLM2 == undefined){
				this.selectedLLM2 =  this.llmSpecs[0]
			}
		}

		if(this.collections && this.collections.length > 0){
			this.collections.forEach(collection => {
				if(collection["content"] == this.DEFAULT_COLLECTION){
					this.selectedCollection = collection;
					this.ragForm.controls["collection_name"].setValue(collection["content"]);
					this.ragConfig['vectordb_config']['collection_name'] = collection["content"];
					if ("metadata" in collection && "embedding_model" in collection["metadata"]){
						console.log("EMBEDDING MODEL: ", collection["metadata"]["embedding_model"]);
						this.ragConfig['vectordb_config']['embedding_model'] = collection["metadata"]["embedding_model"];
						this.ragForm.controls["embedding_model"].setValue(collection["metadata"]["embedding_model"]);
					}
					console.log("IN fetchCollections, collection_name: ", this.ragForm.controls["collection_name"].value);
				}
			});
			if(!this.selectedCollection){
				this.selectedCollection = this.collections[0];
			}

			this.doc_path = `${environment.BACKEND_API_URL}/docs/${this.selectedVectorDB}/${this.ragForm.controls["collection_name"].value}`
		}

		this.createLLMForm();
		this.showPageContent(PageContent.QnA);
	}

	loadDefaultQuestions(){
		this.defaultQuestions = [];
		let key = "direct_questions";
		if(this.enable_rag_checked){
			key = "rag_questions"
		}
		// if(this.selectedCollection === "IBM_Annual_Report_2023"){
		// 	key="IBM_Annual_Report_2023"
		// }
		// else if(this.selectedCollection === "Matercard_FAQs"){
		// 	key="Matercard_FAQs"
		// }
		// else if(this.selectedCollection === "PRINTER_cpd58007"){
		// 	key="PRINTER_cpd58007"
		// }

		// console.log("selected collection ",this.selectedCollection)
		// console.log("selected vectordb ",this.selectedVectorDB)
		// if(this.demoData && this.demoData[key] && this.demoData[key]["questions"] && this.demoData[key]["questions"].length > 0){
		// 	this.demoData[key]["questions"].forEach((element, index) => {
		// 		let qna: any = {
		// 			id: index+1,
		// 			content: element.question,
		// 			expected_ans: element.expected_ans
		// 		}

		// 		if('prompt' in this.demoData[key]){
		// 			qna['prompt'] = this.demoData[key]['prompt'];
		// 		}

		// 		this.defaultQuestions.push(qna);
		// 	});
		// }

		console.log("selected collection = ",this.selectedCollection)
		console.log("selected data = ",this.demoData[key])
		
		if (key === "rag_questions") {
			let questions;
			if (this.demoData[key] && this.demoData[key][this.selectedCollection]) {
				questions = this.demoData[key][this.selectedCollection]["questions"];
			} else {
				questions = []; // Assign an empty array instead of an object to prevent errors
				console.warn("Please select a collection.");
			}
		
			console.log("filtered questions = ", questions);
		
			if (Array.isArray(questions)) { // Ensure questions is an array before iterating
				questions.forEach((element, index) => {
					let qna: any = {
						id: index + 1,
						content: element.question,
						expected_ans: element.expected_ans,
					};
		
					// Check if there's a prompt specific to the collection
					if ("prompt" in this.demoData[key]) {
						qna["prompt"] = this.demoData[key]["prompt"];
					}
		
					this.defaultQuestions.push(qna);
				});
			}
		} else {
			if (Array.isArray(this.demoData[key]["questions"])) {
				this.demoData[key]["questions"].forEach((element, index) => {
					let qna: any = {
						id: index + 1,
						content: element.question,
						expected_ans: element.expected_ans
					};
		
					if ('prompt' in this.demoData[key]) {
						qna['prompt'] = this.demoData[key]['prompt'];
					}
		
					this.defaultQuestions.push(qna);
				});
			}
		}
		
	}

	showPageContent(content: any){
		console.log('IN showPageContent: ', content);
		this.referenceText = null;
		this.sourceNodes = null;
		this.enable_rag_checked = false;
		this.showContent = content;
		this.llmForm.controls["inputTxt"].setValue(null);
		this.llmForm.controls["min_new_tokens"].setValue(10);
		this.llmForm.controls["max_new_tokens"].setValue(200);
		this.llmPayload.parameters.min_new_tokens = 10;
		this.llmPayload.parameters.max_new_tokens = 200;

		if(this.llmSpecs && this.llmSpecs.length > 0){
			this.llmSpecs.forEach(llmSpec => {
				if(llmSpec.id == "ibm/granite-3-8b-instruct"){
					// this.selectedLLM1 = {...llmSpec};
					this.selectedLLM1 = llmSpec;
					console.log("IN EXTRACTION Flow, Selected LLM1: ", this.selectedLLM1);
				}
			});
		}

		if(this.showContent == PageContent.QnA){
			this.METRICS.llm_as_judge = false;
			this.loadDefaultQuestions();
			this.defaultPrompt = this.demoData.rag_questions['prompt'];
			if(this.llmPayload["enable_rag"] == true){
				this.promptRows = 20;
			}else{
				this.promptRows = 20;
			}
		}

		if(this.showContent == PageContent.SUMMARIZATION){
			this.promptRows = 20;
			this.llmForm.controls["inputTxt"].setValue(this.demoData.summarization['prompt']);
			this.llmPayload.parameters.stop_sequences = ["<|endoftext|>"];
			this.referenceText = this.demoData.summarization['expected_ans']
		}

		if(this.showContent == PageContent.EXTRACTION){
			if(this.llmSpecs && this.llmSpecs.length > 0){
				this.llmSpecs.forEach(llmSpec => {
					if(llmSpec.id == "ibm/granite-8b-code-instruct"){
						// this.selectedLLM1 = {...llmSpec};
						this.selectedLLM1 = llmSpec;
						console.log("IN EXTRACTION Flow, Selected LLM1: ", this.selectedLLM1);
					}
				});
			}

			this.METRICS.llm_as_judge = false;
			this.promptRows = 20;
			this.defaultPrompt = this.demoData.extraction['prompt'];
			this.selectedQuestion = {
				content: this.demoData.extraction['entities'],
				expected_ans: this.demoData.extraction['expected_ans']
			}
			// this.selectedQuestion.content = this.demoData.extraction['question'];
			// this.selectedQuestion.expected_ans = this.demoData.extraction['expected_ans'];
			this.referenceText = this.selectedQuestion.expected_ans;

			this.llmForm.controls["inputTxt"].setValue(this.selectedQuestion.content);
			this.llmForm.controls["max_new_tokens"].setValue(800);
			this.llmPayload.parameters.max_new_tokens = 800;
			this.llmPayload.parameters.stop_sequences = ["]", "<|endoftext|>"];
		}

		if(this.showContent == PageContent.CLASSIFICATION){
			this.llmForm.controls["inputTxt"].setValue(this.demoData.classification['prompt2']);
			this.llmPayload.parameters.stop_sequences = ["<|endoftext|>", "\n\n"];
			this.promptRows = 20;
			this.llmForm.controls["min_new_tokens"].setValue(1);
			this.llmForm.controls["max_new_tokens"].setValue(5);
			this.llmPayload.parameters.min_new_tokens = 1;
			this.llmPayload.parameters.max_new_tokens = 5;
		}

		if(this.showContent == PageContent.GENERATION){
			this.llmForm.controls["inputTxt"].setValue(this.demoData.generation['prompt']);
			this.llmPayload.parameters.stop_sequences = ["<|endoftext|>"];
			this.selectedQuestion = {
				content: this.demoData.generation['question'],
				expected_ans: this.demoData.generation['expected_ans']
			}
			this.referenceText = this.selectedQuestion.expected_ans;
			this.promptRows = 20;
		}

	}

	showSettingsPanel(){
		this.showSettings = !this.showSettings;
	}

	replaceChange(event){
		console.log("IN replaceChange, ", event);
		this.replace_checked = event;
		if(event == false){
			this.ragConfig["vectordb_config"]["replace"] = false;
			this.ragForm.controls['replace'].setValue(false);
		}else{
			this.ragConfig["vectordb_config"]["replace"] = true;
			this.ragForm.controls['replace'].setValue(true);
		}
	}

	decodingChange(event){
		console.log("IN decodingChange, ", event);
		this.llm_param_decoding = event;
		if(event == false){
			this.llmPayload.parameters["decoding_method"] = "sample";
			this.llmForm.controls['decoding_method'].setValue("sample");
		}else{
			this.llmPayload.parameters["decoding_method"] = "greedy";
			this.llmForm.controls['decoding_method'].setValue("greedy");
		}

	}

	ragEnableChange(event){
		console.log("IN ragEnableChange, ", event);
		this.enable_rag_checked = event;
		if(event == false){
			this.sourceNodes = null;
			this.promptRows = 2;
			this.llmPayload["enable_rag"] = false;
			this.llmForm.controls['enable_rag'].setValue(false);
		}else{
			this.promptRows = 20;
			if(!this.ragForm){
				this.createRagForm();
			}
			this.llmPayload["enable_rag"] = true;
			this.llmForm.controls['enable_rag'].setValue(true);
		}
		this.loadDefaultQuestions();
	}

	llmCostChange(event){
		console.log("IN llmCostChange: ", event);
		let cost = 0.0
		if(event.source){
			// let pattern = /^\d+\.?\d{0,2}$/;
			// let result = pattern.test(event.value);
			cost = Number((Number(event.value)).toFixed(2));
			if(event.source.id == "llm1_input_cost"){
				this.selectedLLM1["price_input"] = cost;
			}
			if(event.source.id == "llm1_output_cost"){
				this.selectedLLM1["price_output"] = cost;
			}
			if(event.source.id == "llm2_input_cost"){
				this.selectedLLM2["price_input"] = cost;
			}
			if(event.source.id == "llm2_output_cost"){
				this.selectedLLM2["price_output"] = cost;
			}
		}

		if('target' in event){
			cost = Number((Number(event.target.value)).toFixed(2));
		}
		console.log("COST: ", cost);
		if(this.performanceChild){
			this.performanceChild.updateChart();
		}else{
			console.log("this.performanceChild: >> ", this.performanceChild);
		}
	}

	apiCallsChange(event){
		let apiCalls = 1000;
		if('target' in event){
			apiCalls = Number(event.target.value);
		}

		if('value' in event){
			apiCalls = Number(event.value);
		}
		console.log("IN apiCallsChange, apiCalls: ", apiCalls);
		this.costConfig['perDayAPICalls'] = apiCalls;
		if(this.performanceChild){
			this.performanceChild.updateChart();
		}else{
			console.log("this.performanceChild: >> ", this.performanceChild);
		}
	}

	resetSettings(){
		if(!this.llmPayload){
			this.llmPayload = new LLMPayload();
			this.llmPayload.clear();
		}else{
			this.llmPayload.parameters.clear();
		}

		if(!this.ragConfig){
			this.ragConfig = new RagConfig();
			this.ragConfig.clear();
		}else{
			this.ragConfig.clear();
		}
		
		this.selectedFileName = '';  // Clear uploaded file
		this.selectedCollection = ''; // Clear selected collection

		console.log("IN resetSettings: >>", this.llmPayload.parameters);
	}
	

	createLLMForm() {
		this.llmPayload = new LLMPayload();
		this.llmPayload.clear();
		this.llmForm = this.llmFB.group({
			enable_rag: [this.llmPayload['enable_rag'], Validators.required],
			inputTxt: [this.llmPayload.input, Validators.required],
			customQuestion: [this.llmPayload.input],
			collection_name: [],
			decoding_method: [this.llmPayload.parameters['decoding_method'], Validators.required],
			min_new_tokens: [this.llmPayload.parameters['min_new_tokens'],  Validators.pattern('^[0-9]+$')],
			max_new_tokens: [this.llmPayload.parameters['max_new_tokens'], Validators.pattern('^[0-9]+$')],
			repetition_penalty: [this.llmPayload.parameters['repetition_penalty'], Validators.pattern('^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$')],
			stop_sequences: [this.llmPayload.parameters['stop_sequences']]
		});

		this.llm_param_decoding = this.llmPayload.parameters['decoding_method'] == "greedy";
		// console.log("IN createLLMForm, decoding_method: ", this.llmPayload.parameters['decoding_method']);

		if(this.selectedCollection && this.selectedCollection.content){
			this.llmForm.controls['collection_name'].setValue(this.selectedCollection.content);
		}
	}

	createExternalLLMConfigForm() {
		if(!this.llmPayload){
			this.llmPayload = new LLMPayload();
			this.llmPayload.clear();
		}

		this.externalLLMConfigForm = this.externalLLMConfigFB.group({
			openai_api_key: [this.externalLLMConfig['openai_api_key']]
		});

		console.log("IN createExternalLLMConfigForm: >> COMPLETED");
	}

	async createRagForm(){
		if(!this.ragConfig){
			this.ragConfig = new RagConfig();
			this.ragConfig.clear();
		}

		this.ragForm = this.ragFB.group({
			loader: [this.ragConfig['loader'], Validators.required],
			splitter: [this.ragConfig['splitter'], Validators.required],
			replace: [this.ragConfig['vectordb_config']['replace'], Validators.required],
			// embedding: [this.ragConfig['vectordb_config']['embedding'], Validators.required],
			embedding_model: [this.ragConfig['vectordb_config']['embedding_model']],
			db_name: [this.ragConfig['vectordb_config']['db_name'], Validators.required],
			collection_name: [this.ragConfig['vectordb_config']['collection_name'], Validators.required],
			chunk_size: [this.ragConfig['chunk_size'], Validators.required],
			chunk_overlap: [this.ragConfig['chunk_overlap'], Validators.required],
			chunk_separator: [this.ragConfig['chunk_separator']]
		});

		this.selectedVectorDB = this.ragConfig['vectordb_config']['db_name'];
	}

	async updateExternalLLMConf(){
		// this.selectedPlatform = "watsonx";
		// this.showSettings = false;
		this.hasExternalLLMConfigFormErrors = false;
			const controls = this.externalLLMConfigForm.controls;
			/** check form */
			if (this.externalLLMConfigForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasExternalLLMConfigFormErrors = true;
				console.log('SettingsForm has errors: >> ', this.hasExternalLLMConfigFormErrors);
				return;
			}

			this.externalLLMConfig['openai_api_key'] =  controls['openai_api_key'].value;
			await this.fetchExternalLLMSpecs();
			this.openExtLLMConfModal = false;
	}

	// filesAdded(files: Set<File>){
	// 	console.log("IN filesAdded: event >> ", files.values());
	// 	this.addedFiles = [];
	// 	this.collection_name = null;
	// 	for(const data of files.values()){
	// 		this.addedFiles.push(data["file"]);
	// 		// this.addedFiles.push(data);
	// 	}
	// 	if(this.addedFiles && this.addedFiles.length > 0){
	// 		const file_name = this.addedFiles[0].name;
	// 		this.collection_name = file_name.split('.')[0];
	// 		this.ragForm.controls['collection_name'].setValue(this.collection_name);
	// 	}

	// 	console.log("IN filesAdded: addedFiles >> ", this.addedFiles);
	// }

	filesAdded(files: Set<File>) {
		console.log("IN filesAdded: event >> ", files.values());
	  
		this.addedFiles = [];
		this.collection_name = null;
	  
		// Iterate through the Set and push the file objects directly
		for (const file of files.values()) {
		  // Ensure the file is valid before pushing
		  if (file instanceof File) {
			this.addedFiles.push(file);
		  } else {
			console.error('Invalid file object:', file);
		  }
		}
	  
		if (this.addedFiles.length > 0) {
		  const file_name = this.addedFiles[0].name;
	  
		  // Extract the collection name from the file name
		  this.collection_name = file_name.split('.')[0];
		  this.ragForm.controls['collection_name'].setValue(this.collection_name);
		}
	  
		console.log("IN filesAdded: addedFiles >> ", this.addedFiles);
	}

	onFileSelect(event: Event) {
		const target = event.target as HTMLInputElement; // Get the clicked radio button
		const selectedFileName = target.value; // Extract the value (file name)
	  
		if (selectedFileName) {
		  this.selectedFileName = selectedFileName; // Update the selected file name
		  this.selectedCollection = this.selectedFileName;
		  this.ragForm.controls['collection_name'].setValue(this.selectedFileName);
	  
		  // Define a mapping of selected file names to their respective paths
		  const fileMap: { [key: string]: string } = {
			'IBM_Annual_Report_2023': '../../../assets/sample_docs/IBM_Annual_Report_2023.pdf',
			'Matercard_FAQs': '../../../assets/sample_docs/Matercard_FAQs.pdf',
			'PRINTER_cpd58007': '../../../assets/sample_docs/PRINTER_cpd58007.pdf'
		  };
	  
		  // Check if the selected file name exists in the mapping
		  if (fileMap[this.selectedFileName]) {
			const filePath = fileMap[this.selectedFileName];
	  
			// Fetch the file and create a Blob
			fetch(filePath)
			  .then(response => {
				if (!response.ok) {
				  throw new Error(`Failed to load file: ${filePath}`);
				}
				console.log("able to load file",response)
				return response.blob();
			  })
			  .then(blob => {
				const file = new File([blob], this.selectedFileName + '.pdf', { type: 'application/pdf' });
	  
				// Create a Set<File> to pass to filesAdded
				const fileSet = new Set<File>();
				fileSet.add(file);
	  
				// Call filesAdded with the predefined file
				this.filesAdded(fileSet);
			  })
			  .catch(error => console.error('Error loading file:', error));
		  } else {
			console.error('No matching file found for the selected collection.');
		  }
		} else {
		  alert('Please select a document.');
		  this.ragForm.controls['collection_name'].setValue(null);
		}
	  
		this.loadDefaultQuestions();
	  }
	  
	  
	
	//   filesAdded(fileName: string) {
	// 	console.log(`Selected file name: ${fileName}`);
	// 	this.selectedCollection = this.selectedFileName;
	// 	this.ragForm.controls['collection_name'].setValue(this.selectedFileName);
		
	//   }

	

	// filesAdded(files: Set<File>) {
	// 	console.log("IN filesAdded: event >> ", files.values());
	// 	this.addedFiles = [];
	// 	this.collection_name = null;
	
	// 	// Allowed file names
	// 	const allowedFiles = [
	// 		'IBM_Annual_Report_2023.pdf',
	// 		'Matercard_FAQs.pdf',
	// 		'PRINTER_cpd58007.pdf'
	// 	];
	
	// 	const validFiles: File[] = [];
	
	// 	for (const data of files.values()) {
	// 		const file = data["file"];
	// 		if (allowedFiles.includes(file.name)) {
	// 			this.addedFiles.push(file);
	// 			validFiles.push(file); // Add valid files to the list
	// 		} else {
	// 			alert(`Invalid file: ${file.name}. Please upload a file from the given sample documents.`);
	// 		}
	// 	}
	
	// 	// Reset the uploader if there are invalid files
	// 	if (validFiles.length !== files.size) {
	// 		this.resetUploader(); // Call the resetUploader method to clear invalid files
	// 	}
	
	// 	if (this.addedFiles && this.addedFiles.length > 0) {
	// 		const file_name = this.addedFiles[0].name;
	// 		this.collection_name = file_name.split('.')[0];
	// 		this.ragForm.controls['collection_name'].setValue(this.collection_name);
	// 	} else {
	// 		// Clear the collection name if no valid files are added
	// 		this.ragForm.controls['collection_name'].setValue(null);
	// 	}
	
	// 	console.log("IN filesAdded: addedFiles >> ", this.addedFiles);
	// }

	// resetUploader() {
	// 	this.showUploader = false; // Hide the uploader
	// 	setTimeout(() => (this.showUploader = true), 0); // Reinitialize the uploader
	// }
	
	
	
	
	async fetchContext(query, prompt: string){
		this.ragConfig = this.prepareRAGConfig();
		this.ragConfig.vectordb_config.collection_name = this.llmForm.controls['collection_name'].value;
		this.ragConfig.vectordb_config.collection_name = this.selectedCollection;
		console.log("IN fetchContext : >>> ", this.ragConfig, prompt);
		const payload = {
			"query": query,
			"fetch_count": 3,
			"vectordb_config": this.ragConfig.vectordb_config,
			"where": []
		}

		if(this.showContent == PageContent.EXTRACTION){
			payload['fetch_count'] = 3;

			// if(this.ragForm.controls["db_name"].value == "MILVUSDB"){
			payload['where'] = [{"key": "node_type", "operator": "==", "value":"TableItem"}]
			// }
		}

		this.loaders["fetch_context"] = true;
		this.selectedVectorDB = this.ragConfig.vectordb_config['db_name'];
		try{
			this.sourceNodes = [];
			const resp = await lastValueFrom(this.llmService.fetchContext(payload));
			if(resp){
				console.log("RESPONSE OF fetchContext: >> ", resp);
				this.loaders["fetch_context"] = false;
				if ("items" in resp && resp["items"].length > 0){
					this.sourceNodes = resp["items"]
				}
				prompt = this.formatPromptFromMilvusDBContext(prompt, query, this.sourceNodes);

				if(this.llmForm){
					this.llmForm.controls["inputTxt"].setValue(prompt);
				}
				return prompt;
			}else{
				return prompt
			}
		}catch (error) {
			console.log("ERROR", error);
			this.loaders["fetch_context"] = false;
				console.log(error);
				prompt = prompt.replace("{query}", query);
				if(this.llmForm){
					this.llmForm.controls["inputTxt"].setValue(prompt);
				}

			let msg = "Error in fetching Context!"
			if ('error' in error && 'detail' in error['error']){
				msg = error['error']['detail']
			}
			const notificationObj = {
				type: 'error',
				title: "Error: Fetch Context",
				message: msg,
				lowContrast: false,
				showClose: true
			}
			this.showNotification(notificationObj, true)
			return prompt
		}
	}

	async loadDocuments(){
		this.openLoadDocsModal = false;
		this.ragConfig = this.prepareRAGConfig();
		console.log("IN loadDocuments : >>> ", this.ragConfig);
		const payload = {
			"files": this.addedFiles,
			"ragConfig": this.ragConfig
		}
		this.loaders["load_documents"] = true;
		try{

			await this.initSocket();

			const resp1 = await lastValueFrom(this.llmService.loadDocuments(payload));
			if (resp1 && resp1.items){
				console.log("loadDocuments resp: >> ", resp1);
				const payload = {
					"savedFiles": resp1.items,
					"ragConfig": this.ragConfig
				}
				const resp2 = await lastValueFrom(this.llmService.parseDocuments(payload));
				console.log("RESPONSE OF loadDocuments: >> ", resp2);

				if(resp2 && resp2.uid){
					this.loaders["load_documents"] = false;
					const notificationObj = {
						type: 'success',
						title: "Success: ",
						message: `Documents Load Task Created Successfully: ${resp2.uid}`,
						lowContrast: false,
						showClose: true
					}

					this.showNotification(notificationObj, false);
					let taskResp = null;
					let count = 0
					let timer = setInterval(async () => {
						// this.closeNotification();
						taskResp = await lastValueFrom(this.llmService.fetchTaskStatus(resp2.uid));
							console.log("taskResp: >> ", taskResp);
							if (taskResp && count == 0){
								const notificationObj = {
									type: 'info',
									title: "Task Updates: ",
									message: `Documents Load Task: ${resp2.uid} is still running !!`,
									lowContrast: false,
									showClose: true
								}
								this.showNotification(notificationObj, false)
							}
							count++;
						if (count > 20 || !taskResp || ('status' in taskResp && taskResp['status'] != 'IN_PROGRESS')){
							clearInterval(timer);
							// this.closeNotification();
							const notificationObj = {
								type: 'success',
								title: "Success: ",
								message: `Documents Load Task: ${resp2.uid} Completed Successfully !!`,
								lowContrast: false,
								showClose: true
							}
							this.showNotification(notificationObj, true)
							await this.fetchCollections()
						}
					}, 60000);
				}
			}

		}catch (error) {
			console.log("ERROR", error);
			this.loaders["load_documents"] = false;
			let msg = "Error in loading/parsing documents!"
			if ('error' in error && 'detail' in error['error']){
				msg = error['error']['detail']
			}
			const notificationObj = {
				type: 'error',
				title: "Error: Load Documents",
				message: msg,
				lowContrast: false,
				showClose: true
			}
			this.showNotification(notificationObj, true)
		}

	}

	async generateResponse(){
		try {
			// this.refreshBeforeGenerate();
			this.hasllmFormErrors = false;
			this.showPerformanceGraph = false;
			const controls = this.llmForm.controls;
			if(this.evaluationsChild){
				await this.evaluationsChild.reset()
				this.evaluationsChild.showEvaluations = false;
			}

			if (this.llmForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);
				this.hasllmFormErrors = true;
				console.log('LLMForm has errors: >> ', this.hasllmFormErrors);
				return;
			}

			// console.log("IN generateResponse, RAG Enabled: ", this.enable_rag_checked, ", llmForm: ", controls["inputTxt"].value);
			if (this.enable_rag_checked && controls["inputTxt"].value.length < 300){
				console.log("IN generateResponse, inputText length: ", controls["inputTxt"].value.length);
				await this.retrieveContext()
			}

			console.log('IN generateResponse for ', this.selectedLLM1.id);
			const llm1Payload = this.prepareLLMPayload(this.selectedLLM1);
			this.generateChild1.reset();
			this.generateChild1.generateResponse(llm1Payload, this.sourceNodes);

			console.log('IN generateResponse for ', this.selectedLLM2.id);
			const llm2Payload = this.prepareLLMPayload(this.selectedLLM2);
			this.generateChild2.reset();
			if(this.selectedPlatform == 'watsonx'){
				await this.generateChild2.generateResponse(llm2Payload, this.sourceNodes);
			}else{
				await this.generateChild2.generateExternalResponse(llm2Payload, this.externalLLMConfig["openai_api_key"], this.sourceNodes);
			}

		} catch (e) {
			console.log(e);
		}
	}

	private async fetchCollections(){
		console.log("IN fetchCollections: >> ", this.selectedVectorDB);
		// this.ragConfig = this.prepareRAGConfig();
		this.ragConfig = new RagConfig();
		if(this.selectedVectorDB){
			if(this.selectedVectorDB.content){
				this.ragConfig.vectordb_config.db_name = this.selectedVectorDB.content;
			}else{
				this.ragConfig.vectordb_config.db_name = this.selectedVectorDB;
			}
		}
		// let resp = await this.llmService.fetchCollections(this.ragConfig).toPromise();
		const resp = await lastValueFrom(this.llmService.fetchCollections(this.ragConfig));

		if(resp && resp.items){
			this.collections = [];
			resp.items.forEach(async element => {
				let collection: any = {
					id: element.name,
					content: element.name
				}
				// console.log(element.metadata)
				if(element.metadata){
					try{
						const metadata = JSON.parse(element.metadata.replace(/'/g, '"'));
						collection["metadata"] = metadata;
					}catch(e) {
						// console.error(e);
						collection["metadata"] = element.metadata;
					}
				}

				this.collections.push(collection);
			});
			console.log("IN fetchCollections, resp: ", this.collections);
		}
	}

	// async showDeleteCollectionModal(){
	// 	const selectedCollectionName  = this.ragForm.controls["collection_name"].value;
	// 	this.modalService.show({
	// 					type: AlertModalType.danger,
	// 					content: `Do you really want to delete this collection: ${selectedCollectionName} ?`,
	// 					title: "Delete DB Collection",
	// 					buttons: [{
	// 						text: "Delete",
	// 						type: ModalButtonType.danger,
	// 						click: async () => {
	// 							await this.deleteCollection()
	// 						}
	// 					},
	// 					{
	// 						text: "Cancel",
	// 						type: ModalButtonType.secondary
	// 					}],
	// 					showCloseButton: false
	// 		});
	// }

	// async showLoadDocumentModal(){
	// 	const selectedCollectionName  = this.ragForm.controls["collection_name"].value;
	// 	console.log("IN showLoadDocumentModal, selectedCollectionName: ", selectedCollectionName);
	// 	try{
	// 		this.modalService.show({
	// 			type: AlertModalType.danger,
	// 			content: `Data will be loaded to this collection: ${selectedCollectionName}`,
	// 			title: "Load Documents to VectorDB",
	// 			buttons: [{
	// 				text: "Load",
	// 				type: ModalButtonType.danger,
	// 				click: () => {
	// 					this.loadDocuments()
	// 				}
	// 			},
	// 			{
	// 				text: "Cancel",
	// 				type: ModalButtonType.secondary
	// 			}],
	// 			showCloseButton: false
	// 		});
	// 	}catch(err){
	// 		console.error(err);
	// 	}

	// }

	async deleteCollection(){
		console.log("IN deleteCollection: >> ", this.selectedVectorDB);
		this.openDeleteCollectionModal = false;
		const selectedCollectionName  = this.ragForm.controls["collection_name"].value;
		let resp = await this.llmService.deleteCollection("MILVUSDB", selectedCollectionName).toPromise();

		if(resp == true){
			const notificationObj = {
				type: 'success',
				title: "Success: ",
				message: 'Documents Deleted Successfully',
				lowContrast: false,
				showClose: true
			}

			this.collections.forEach( (item, index) => {
				if(item.id === selectedCollectionName) this.collections.splice(index,1);
			});
			this.cdr.detectChanges();
			console.log("IN deleteCollection, resp: ", resp);
			this.showNotification(notificationObj, true)
		}

		await this.fetchCollections();
	}

	private async fetchIBMLLMSpecs(){
		console.log("IN fetchLLMSpecs, this.loggedInUser: ", this.loggedInUser);
		try{
			const llmSpecsResp = await lastValueFrom(this.llmService.fetchIBMLLMSpecs());
			if(llmSpecsResp && llmSpecsResp.items){
				this.llmSpecs = [];
				llmSpecsResp.items.forEach(async element => {
					if(element.price_output > 5){  // && !this.isAdmin
						console.log("USER IS NOT AN ADMIN, SO SKIPPING MODEL: ", element);
						return;
					}
					let llmSpec: any = {
						id: element.model_id,
						content: element.label,
						task_ids: element.task_ids,
						input_tier: element.input_tier,
						output_tier: element.input_tier,
						price_input: element.price_input,
						price_output: element.price_output,
						platform: element.platform || "watsonx",
						pricing_page: element.pricing_page || "https://www.ibm.com/products/watsonx-ai/foundation-models#generative"
					}

					this.llmSpecs.push(llmSpec);
				});
			}
		}catch (error) {
			console.log("ERROR", error);
			let msg = "Error in fetching LLM specs!"
			if ('error' in error && 'detail' in error['error']){
				msg = error['error']['detail']
			}
			const notificationObj = {
				type: 'error',
				title: "Error: Fetch LLM Specs",
				message: msg,
				lowContrast: false,
				showClose: true
			}
			this.showNotification(notificationObj, true)
		}

		console.log("IN fetchLLMSpecs, this.llmSpecs: ", this.llmSpecs);
	}

	private async fetchExternalLLMSpecs(){
		try{
			const externalLLMSpecsResp: any = await lastValueFrom(this.llmService.fetchExternalLLMSpecs(this.externalLLMConfig["openai_api_key"]));
			// const externalLLMSpecsResp = await this.llmService.fetchExternalLLMSpecs(this.externalLLMConfig["openai_api_key"]).toPromise();
			if(externalLLMSpecsResp && externalLLMSpecsResp.items){
				this.externalLLMSpecs = [];
				externalLLMSpecsResp.items.forEach(async element => {
					// console.log("\n\nLLMSpec: >> ", element);
					let llmSpec: any = {
						id: element.model_id,
						content: element.label,
						price_input: element.price_input,
						price_output: element.price_output,
						platform: element.platform || "external",
						pricing_page: element.pricing_page || "https://openai.com/pricing"
					}
					this.externalLLMSpecs.push(llmSpec);
				});
			}
		}catch (error) {
			console.log("ERROR", error);
			let msg = "Error in fetching LLM specs!"
			this.externalLLMConfig["openai_api_key"] = null;
			if ('error' in error && 'detail' in error['error']){
				msg = error['error']['detail']
			}
			const notificationObj = {
				showFor: 'error_external_llm_specs',
				type: 'error',
				title: "Error: Fetch External LLM Specs",
				message: msg,
				lowContrast: false,
				showClose: true
			}
			this.showNotification(notificationObj, true)
		}
	}

	private async refreshWXToken(){
		console.log("IN refreshWXToken: >> ");
		// const token = await this.llmService.refreshTokens().toPromise();
		const token = await lastValueFrom(this.llmService.refreshTokens());
		console.log("TOKEN: ", token);
	}


	private prepareLLMPayload(modelSpec: any): any {
		const controls = this.llmForm.controls;
		const _payload = new LLMPayload();
		_payload.clear();
		_payload.input = controls['inputTxt'].value;
		_payload.modelid = modelSpec.id;
		_payload.enable_rag = this.enable_rag_checked;
		_payload.parameters = this.prepareLLMParams();
		_payload.vectordb_config.replace = false;
		if(this.collections && this.collections.length > 0){
			if(this.selectedVectorDB){
				_payload.vectordb_config.db_name = this.selectedVectorDB;
			}
			this.collections.forEach(collection => {
				if(collection["content"] == controls['collection_name'].value){
					_payload.vectordb_config.collection_name = collection["content"];
					if("metadata" in collection && "embedding_model" in collection.metadata){
						_payload.vectordb_config.embedding_model = collection.metadata.embedding_model;
					}
				}
			});
		}

		// _payload.vectordb_config.db_name = controls['db_name'].value;

		_payload.asynchronous = true;
		return _payload;
	}

	private prepareLLMParams(): any {
		const controls = this.llmForm.controls;
		const _params = new LLMParams();
		_params.clear();
		_params.decoding_method = controls['decoding_method'].value;
		_params.min_new_tokens = Number(controls['min_new_tokens'].value);
		_params.max_new_tokens = Number(controls['max_new_tokens'].value);
		_params.repetition_penalty = Number(controls['repetition_penalty'].value);
		_params.stop_sequences = this.llmPayload.parameters.stop_sequences;

		console.log("decoding_method: >> ", controls['decoding_method'].value);

		if(this.externalLLMConfigForm){
			const externalLLMControls = this.externalLLMConfigForm.controls;
			this.externalLLMConfig['openai_api_key'] =  externalLLMControls['openai_api_key'].value;
		}

		return _params;
	}

	private prepareRAGConfig(): any {
		const controls = this.ragForm.controls;
		const _ragConfig = new RagConfig();
		_ragConfig.clear();
		_ragConfig.loader = controls['loader'].value;
		_ragConfig.splitter = controls['splitter'].value;
		_ragConfig.vectordb_config.replace = controls['replace'].value;
		// _ragConfig.vectordb_config.embedding = controls['embedding'].value;
		_ragConfig.vectordb_config.embedding_model = controls['embedding_model'].value;
		_ragConfig.vectordb_config.collection_name = controls['collection_name'].value;
		_ragConfig.vectordb_config.db_name = controls['db_name'].value;
		_ragConfig.chunk_size = controls['chunk_size'].value;
		_ragConfig.chunk_overlap = controls['chunk_overlap'].value;
		_ragConfig.chunk_separator = controls['chunk_separator'].value;

		if (this.loggedInUser && this.loggedInUser.id){
			const audit = new Audit()
			audit.user_id = this.loggedInUser.id
			_ragConfig.audit = audit;
		}

		return _ragConfig;
	}

	public updateParentEvent(result){
		console.log("IN ComparisonComponent.updateParentEvent: >> ", result);
		this.checkAndEvaluateLLMResponses(result["modelId"], result["llmResponse"]);
	}

	public checkAndEvaluateLLMResponses(modelId, llmResponse){

		if (modelId == this.selectedLLM1.id){
			this.llm1Response = llmResponse;
			this.llm1Response["model_id"] = modelId
			console.log("IN checkAndEvaluateLLMResponses: >> modelId LLM1: ", modelId, ", llm1Response: ", this.llm1Response);
		}

		if (modelId == this.selectedLLM2.id){
			this.llm2Response = llmResponse;
			this.llm2Response["model_id"] = modelId
			console.log("IN checkAndEvaluateLLMResponses: >> modelId LLM2: ", modelId, ", llm2Response: ", this.llm2Response);
		}
		if(this.llm1Response && this.llm2Response){
			this.showPerformanceGraph = true;
		}

		if(this.llm1Response && "output" in this.llm1Response && this.llm2Response && "output" in this.llm2Response){
			if("stop_reason" in this.llm1Response["output"] && "stop_reason" in this.llm2Response["output"]){
				if(this.llm1Response["output"]["stop_reason"] == "COMPLETED" && this.llm2Response["output"]["stop_reason"]== "COMPLETED"){

					this.fetchEvaluationMetrics(this.llm1Response["model_id"], this.llm1Response).then(() => {
					});

					this.fetchEvaluationMetrics(this.llm2Response["model_id"], this.llm2Response).then(() => {
					});
				}
			}
		}

		// if (modelId == this.selectedLLM1.id){
		// 	this.fetchEvaluationMetrics(modelId, this.llm1Response).then(() => {
		// 	});
		// }
		// if (modelId == this.selectedLLM2.id){
		// 	this.fetchEvaluationMetrics(modelId, this.llm2Response).then(() => {
		// 	});
		// }

		return false;

	}

	private async fetchEvaluationMetrics(modelId, llmResponse){
		console.log("IN fetchEvaluationMetrics for ", modelId);
		const evaluationPayload = {
			"input": this.llmForm.controls["inputTxt"].value,
			"evaluate": []
		};

		if(this.referenceText && this.referenceText.length > 10){
			if(this.METRICS.rouge == true){
				evaluationPayload['evaluate'].push("rouge")
				this.loaders['metrics']['rouge'] = true;
			}
			if(this.METRICS.bleu == true){
				evaluationPayload['evaluate'].push("bleu")
				this.loaders['metrics']['bleu'] = true;
			}
			if(this.METRICS.perplexity == true){
				evaluationPayload['evaluate'].push("perplexity")
				this.loaders['metrics']['perplexity'] = true;
			}

			evaluationPayload['expected_output'] = this.referenceText
		}

		evaluationPayload["generated_output"] = {
			"model_id": modelId,
			"text": llmResponse["output"]["generated_text"]
		}

		this.evaluationMetrics = await this.llmService.fetchEvaluationMetrics(evaluationPayload).toPromise();
		console.log("-------- EVALUATION COMPLETED for  --------- ", modelId);
		await this.evaluationsChild.updateChart(this.evaluationMetrics);

		if(this.METRICS.llm_as_judge){
			evaluationPayload['input'] = this.selectedQuestion.content;
			evaluationPayload['evaluate'] = ["llm_as_judge"]
			const llm_as_judge_params = {
				llm_platform: "watsonx",
				model_id: "ibm/granite-20b-code-instruct",
				llm_params: {
					"decoding_method": "sample",
					"max_new_tokens": 1000,
					"min_new_tokens": 1,
					"temperature": 0.5,
					"top_k": 50,
					"top_p": 1,
					"stop_sequences": ["<|endoftext|>"]
				},
				metrics: "AnswerRelevancyMetric",
				metrics_params: {
					"async_mode": false,
					"verbose_mode": false,
					"include_reason": false,
					"strict_mode": false
				}
			}
			evaluationPayload["llm_as_judge_params"] = llm_as_judge_params;
			const llm_as_judge_result = await this.llmService.fetchEvaluationMetrics(evaluationPayload).toPromise();
			this.evaluationMetrics["metrics"]["llm_as_judge"] = llm_as_judge_result;
			await this.evaluationsChild.updateChart(this.evaluationMetrics);
		}



	}

	private formatPromptFromMilvusDBContext(prompt, query, sourceNodes): string {
		if(prompt && prompt.length > 0){
			let context = "";
			if(sourceNodes){
				sourceNodes.forEach((doc, index) => {
					const node = doc['node']
					console.log(node);
					context = context + "[Document]\n"
					if("extra_info" in node){
						if ("page_label" in node["extra_info"]){
							context = context + "Page - " + node["extra_info"]["page_label"]+" >> "
						}

						if ("doc_items" in node["extra_info"] && node["extra_info"]["doc_items"].length > 0 && 'prov' in node["extra_info"]["doc_items"][0]){
							context = context + "Page No - " + node["extra_info"]["doc_items"][0]["prov"][0]["page_no"]+" - "
						}

						// if ("headings" in node["extra_info"] && node["extra_info"]["headings"].length > 0){
						// 	context = context + node["extra_info"]["headings"].filter(s => s).join(' >> ');
						// }

					}
					context = context + "\n"+ node["text"] + "\n[End]\n\n";
				});
			}


			if(!this.referenceText || this.referenceText.length < 10){
				this.referenceText = context;
			}
			prompt = prompt.replace("{query}", query);
			prompt = prompt.replace("{context}", context);
			console.log("prompt: >> ", prompt);
		}
		return prompt;
	}


}



