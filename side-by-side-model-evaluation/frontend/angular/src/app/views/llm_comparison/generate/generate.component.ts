import { Component, OnInit, AfterViewInit, AfterViewChecked, Input, OnChanges, ViewChild } from '@angular/core';
import { Output, EventEmitter } from '@angular/core';
import { LLMService } from '../../../services';
import { lastValueFrom } from 'rxjs';
import { PDFDocumentProxy, PdfViewerComponent } from 'ng2-pdf-viewer';
import { environment } from 'src/environments/environment';
// import { forEach } from 'lodash';

@Component({
	selector: 'generate',
	templateUrl: './generate.component.html',
	styleUrls: ['./generate.component.scss']
})
export class GenerateComponent implements OnInit, AfterViewInit, AfterViewChecked, OnChanges {

	@Input() ragConfig: any;
	@Input() llmResponse: any;
	@Input() costConfig: any;
	@Input() sourceNodes: any = [];

	@Output() updateParentEvent = new EventEmitter<any>();
	@Output() showContent = new EventEmitter<any>();

	payload: any;
	loaders: any = {
		"api_calling": false
	}

	sourcePage: any;
	openSouceNodeModal: boolean = false;

	@ViewChild(PdfViewerComponent) pdfComponent: PdfViewerComponent;

	constructor(
		private llmService: LLMService,
	) {	 }

	async ngOnInit(): Promise<void> {
		console.log("IN GenerateComponent init: >> ");
		// this.demo_pdf_viewer();
	}

	ngAfterViewInit() {
		console.log("IN GenerateComponent ngAfterViewInit: >> ");
	}

	ngAfterViewChecked() {

    }

	ngOnChanges(){

	}

	reset(){
		this.llmResponse = undefined;
		this.payload = undefined;
		this.sourceNodes = [];
	}

	async generateResponse(payload, sourceNodes){
		console.log("IN GenerateComponent, generateResponse: ", payload);
		// console.log("IN GenerateComponent, llmResponse: ", this.llmResponse);
		this.payload = payload;
		this.sourceNodes = await this.formatSourceNodes(sourceNodes);
		let input_token_count = 0;
		const text = this.payload['input'];
		if(text && text.length > 0){
			const word_count = text.trim().split(/\s+/).length;
			// const word_count = text.split(" ").count;
			const char_count = text.length;
			const tokens_count_word_est = word_count / 0.75;
			const tokens_count_char_est = char_count / 4.0;
			input_token_count = (tokens_count_word_est + tokens_count_char_est) / 2;
			// console.log("tokens_count_word_est: ", tokens_count_word_est, ", tokens_count_char_est: ", tokens_count_char_est, ", input_token_count: ", input_token_count);
		}

		this.llmResponse = {
			"output": {
				"generated_text": "",
				"input_token_count": input_token_count,
				"sourceNodes": this.sourceNodes
			}
		};

		let startTimestamp = 0;

		this.loaders['api_calling'] = true;
		(await this.llmService.generateUsingWatsonx(this.payload)).subscribe(
			async (resp) => {

				if(startTimestamp == 0){
					startTimestamp = +new Date().getTime();
				}

				this.update_ui(resp, startTimestamp, input_token_count);

			},
			(error: any) => {
				this.loaders['api_calling'] = false;
				console.log(error);
			});
	}


	async generateExternalResponse(payload, api_key, sourceNodes){
		this.payload = payload;
		this.sourceNodes = await this.formatSourceNodes(sourceNodes);
		let input_token_count = 0;
		const text = this.payload['input'];
		if(text && text.length > 0){
			const word_count = text.trim().split(/\s+/).length;
			// const word_count = text.split(" ").count;
			const char_count = text.length;
			const tokens_count_word_est = word_count / 0.75;
			const tokens_count_char_est = char_count / 4.0;
			input_token_count = (tokens_count_word_est + tokens_count_char_est) / 2;
			// console.log("tokens_count_word_est: ", tokens_count_word_est, ", tokens_count_char_est: ", tokens_count_char_est, ", input_token_count: ", input_token_count);
		}

		this.llmResponse = {
			"output": {
				"generated_text": "",
				"input_token_count": input_token_count,
				"sourceNodes": this.sourceNodes
			}
		};

		let startTimestamp = +new Date().getTime();
		this.loaders['api_calling'] = true;

		(await this.llmService.generateUsingOpenAI(this.payload, api_key)).subscribe(
			async (resp) => {

				if(startTimestamp == 0){
					startTimestamp = +new Date().getTime();
				}

				this.update_ui(resp, startTimestamp, input_token_count);

			},
			(error: any) => {
				this.loaders['api_calling'] = false;
				console.log(error);
			});
	}

	async update_ui(resp, startTimestamp, input_token_count){

		if(resp != undefined){
			// this.llmResponse["output"]["input_token_count"] = input_token_count;
			const endTimestamp: number = +new Date().getTime();
			const responseTimes = (endTimestamp - startTimestamp) / 1000;
			this.llmResponse['time_taken'] = responseTimes;
			try{
				// console.log(typeof resp)
				this.loaders['api_calling'] = false;
				if(Number.isFinite(resp)){
					resp = `${resp}`;
					resp = String(resp);
					resp = resp.toString();
					console.log("RESP was Number: ", resp);
				}

				if (typeof resp === 'string' && resp.length > 30){
					let jsonResp = this.extractJSON(resp);
					if(jsonResp && jsonResp.length > 0){
						console.log("jsonResp: >> ", jsonResp);
						resp = jsonResp[0]
					}
				}
				// resp = JSON.parse(resp);
				if(resp.length < 30){ // Resp is a number
					this.llmResponse["output"]["generated_text"] = `${this.llmResponse["output"]["generated_text"]}${resp}`;
				}
			}catch(e){
				console.error(e);
				if (resp && resp.length > 30){
					console.log("Invalid Resp: ", resp);
				}

				if (resp && resp.length < 30 && 'generated_text' in this.llmResponse['output']){
					const generated_text = this.llmResponse["output"]["generated_text"]
					this.llmResponse["output"]["generated_text"] = generated_text + resp
				}
			}

			if(typeof resp === 'object' && 'stop_reason' in resp && resp['stop_reason'] == 'COMPLETED'){
				this.llmResponse["output"] = resp;

				if (!("time_taken" in this.llmResponse["output"])){
					const endTimestamp: number = +new Date().getTime();
					const responseTimes = (endTimestamp - startTimestamp) / 1000;
					this.llmResponse['time_taken'] = responseTimes;
				}

				this.llmResponse["output"]["source_nodes"] = this.sourceNodes;

				if ('input_token_count' in resp){
					this.llmResponse["output"]["input_token_count"] = resp["input_token_count"];
					console.log("INPUT TOKEN COUNT 1: ", this.llmResponse["output"]["input_token_count"])
				}else{
					this.llmResponse["output"]["input_token_count"] = input_token_count;
					console.log("INPUT TOKEN COUNT 2: ", this.llmResponse["output"]["input_token_count"])
				}
				// this.llmResponse['time_taken'] = responseTimes;
				const result = {
					modelId: this.payload.modelid,
					llmResponse: this.llmResponse
				}
				console.log("COMPLETED & PARSED RESP: ", result);
				this.updateParentEvent.emit(result);
			}else{
				if(typeof resp === 'object'){
					console.log("END: >> ", resp)
				}
			}

		}
	}

	async sourceSelected(source){
		console.log("IN sourceSelected, source: ", source);
	}

	async showSourcesOnPage(source){
		console.log("IN showSourcesOnPage, source: ", source);
		const file_path = await lastValueFrom(this.llmService.showSourceOnPage(source));
		this.sourcePage = {
			"title": `${source['filename']} (Page: ${source['page_no']})`,
			"file_path": `${file_path}`,
			"text": source['text'],
			"page_no": source['page_no']
		}
		this.openSouceNodeModal = true;
	}

	goToPage(pdf: PDFDocumentProxy){
		console.log("IN goToPage: ", pdf);
		let root = this;
		setTimeout(function(){
			// root.pdfComponent.page = root.sourcePage['page_no'];
			root.pdfComponent.pdfViewer.scrollPageIntoView({
				pageNumber: root.sourcePage['page_no']
			});
		}, 100);
	}

	onPDFLoadError(error: any){
		console.log("onPDFLoadError: >> ", error);
	}

	closeSourceModal(){
		console.log("in closeSourceModal >>> ");
		this.openSouceNodeModal = false;
		this.sourcePage = null;
	}

	async formatSourceNodes(sourceNodes){
		this.sourceNodes = []
		if(sourceNodes && sourceNodes.length > 0){
			sourceNodes.forEach((source) => {
				// console.log(source);
				let node = {
					"filename": "",
					"prefix": this.ragConfig.vectordb_config.db_name,
					"page_no": 0,
					"text": source['node']['text'],
					"score": source['score'],
					"doc_items": []
				}

				if('node' in source && 'extra_info' in source['node'] && 'origin' in source['node']['extra_info']){
					const extra_info = source['node']['extra_info']
					if('origin' in extra_info && 'filename' in extra_info['origin']){
						node['filename'] = extra_info['origin']['filename']
					}

					if('doc_items' in extra_info && extra_info['doc_items'].length > 0 && 'prov' in extra_info['doc_items'][0]){
						const prov = extra_info['doc_items'][0]['prov'];
						node['page_no'] = prov[0].page_no;
						node['doc_items'] = extra_info['doc_items'];
					}
					this.sourceNodes.push(node);

				}


			});
		}

		return this.sourceNodes
	}

	extractJSON(str) {
		var firstOpen, firstClose, candidate;
		firstOpen = str.indexOf('{', firstOpen + 1);
		do {
			firstClose = str.lastIndexOf('}');
			console.log('firstOpen: ' + firstOpen, 'firstClose: ' + firstClose);
			if(firstClose <= firstOpen) {
				return null;
			}
			do {
				candidate = str.substring(firstOpen, firstClose + 1);
				console.log('candidate: ' + candidate);
				try {
					var res = JSON.parse(candidate);
					console.log('...found');
					return [res, firstOpen, firstClose + 1];
				}
				catch(e) {
					console.log('...failed');
					return str;
				}
				firstClose = str.substr(0, firstClose).lastIndexOf('}');
			} while(firstClose > firstOpen);
			firstOpen = str.indexOf('{', firstOpen + 1);
		} while(firstOpen != -1);
	}

	extractJSON2(str: string): any[] {
		let result;
		const objects = [];
		while ((result = this.extract(str)) !== null) {
			try {
				let obj = this.jsonify(result);
				objects.push(obj);
			} catch (e) {
			// Do nothing
				console.log('ERROR: ', str);
			}
			str = str.replace(result, '');
		}
		return objects;
	  }

	jsonify = (almostJson) => {
		try {
		  return JSON.parse(almostJson);
		} catch (e) {
		  almostJson = almostJson.replace(/([a-zA-Z0-9_$]+\s*):/g, '"$1":').replace(/'([^']+?)'([\s,\]\}])/g, '"$1"$2');
		  return JSON.parse(almostJson);
		}
	};

	chars = {
		'[': ']',
		'{': '}'
	};

	any = (iteree, iterator) => {
		let result;
		for (let i = 0; i < iteree.length; i++) {
		  result = iterator(iteree[i], i, iteree);
		  if (result) {
			break;
		  }
		}
		return result;
	  };

	extract = (str) => {
		let startIndex = str.search(/[\{\[]/);
		if (startIndex === -1) {
		  return null;
		}

		let openingChar = str[ startIndex ];
		let closingChar = this.chars[ openingChar ];
		let endIndex = -1;
		let count = 0;

		str = str.substring(startIndex);
		this.any(str, (letter, i) => {
		  if (letter === openingChar) {
			count++;
		  } else if (letter === closingChar) {
			count--;
		  }

		  if (!count) {
			endIndex = i;
			return true;
		  }
		});

		if (endIndex === -1) {
		  return null;
		}

		let obj = str.substring(0, endIndex + 1);
		return obj;
	  };


}
