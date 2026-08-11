import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, NgZone, AfterViewChecked, Input } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { currentUser, User } from 'src/app/core/auth';
import { AppState } from 'src/app/core/reducers';
import { RecognizeStream } from 'src/app/core/stt';
import { AssistantService, ClassificationService } from 'src/app/services';
import recognizeMicrophone from 'watson-speech/speech-to-text/recognize-microphone';
import recognizeFile from 'watson-speech/speech-to-text/recognize-file';
import { io } from "socket.io-client";
import { environment } from 'src/environments/environment';
import { Output, EventEmitter } from '@angular/core';
// import { forEach } from 'lodash';
// import { element } from 'protractor';


@Component({
	selector: 'aa-chat-widget',
	templateUrl: './aa-chat.component.html',
	styleUrls: ['./aa-chat.component.scss']
})
export class AgentAssistChatComponent implements OnInit, AfterViewInit, AfterViewChecked {

	user$: Observable<User>;
	loggedInUser: any
	isOpen: boolean = true;
	title: string = "Watson";
	sessionMap = new Map();
	predictions: any;
	enableDetection: boolean = false;
	userInput: any = {
		text: ""
	}

	hasAudioDevice = false;
	isStreaming: boolean;
	stream: any;
	token: string;
	callTranscript: any = [];

	conversationObj: any;
	conversations: any = [];
	socket: any;
	collectionName = null;
	// customer: any;
	loading: any = {
		active: false,
		overlay: false,
		size: 'sm'
	};

	@Input() parentData: any;

	@Output() updateParentEvent = new EventEmitter<any>();
	@Output() showContent = new EventEmitter<any>();
	@ViewChild('chatContent') private chatContent: ElementRef;

	constructor(
			private ngZone: NgZone,
			private store: Store<AppState>,
			private assistantService: AssistantService,
			private classificationService: ClassificationService
		) {

		 }

	async ngOnInit(): Promise<void> {
		this.user$ = this.store.pipe(select(currentUser));
		this.user$.subscribe(u => {
			this.loggedInUser = u;
		});
		// await this.classificationService.loadModel();
		// if(this.isOpen){
		// 	await this.openChat();
		// }
	}

	ngAfterViewInit() {

	}

	ngAfterViewChecked() {
        // this.scrollToBottom();
    }

	async openChat(){
		// const model = await this.classificationService.loadModel();
		// if (model) {
			await this.initSocket();
			// await this.initSTT();
			await this.initChat();
		// }
	}

	async closeChat(){
		this.isOpen = false;
		this.socket.removeAllListeners();
		this.socket.disconnect();
	}

	async initSocket(){
		this.socket = io(environment.BACKEND_API_URL, {
			withCredentials: false,
			transportOptions: {
			  polling: {
				extraHeaders: {
				  "my-custom-header": "agent-assist"
				}
			  }
			}
		});
	}

	async initChat(){
		console.log('IN InitChat Widget: >> ', this.loggedInUser);
		// this.conversationObj.context['skills']['actions skill']['skill_variables']
		this.conversationObj = {
			"input": {"text": "", "message_type": "text", "options": {"alternate_intents": false, "return_context": true, "debug": true} },
				"context": {
					"global": {
						"system": {
							"user_id": "anonymous"
						}
					},
					"skills": {
						"main skill": {
							"user_defined": {
								"initConversation": true,
								"locale": "en",
								"channel": "WEB",
								"save_in_db": false
							}
						},
						"actions skill": {
							"skill_variables": {
								"DOMAIN": this.parentData.domain.content
							}
						}
					}
				}
		};
		// this.customer = null;
		// "domain": this.parentData.domain
		console.log('IN initChat, parentData :>> ', this.parentData);
		this.sessionMap = new Map();
		this.sendMessage();
		this.isOpen = true;
	}

	async restartChat(){
		this.conversations = [];
		this.initChat();
	}

	async sendMessage(){
		this.conversationObj.input.text = this.userInput.text;
		this.conversationObj.timestamp = Date.now();
		if (this.loggedInUser && this.loggedInUser.id) {
			this.conversationObj.context['skills']['main skill']['user_defined']['user_id'] = this.loggedInUser.id;
		}

		if (this.parentData && this.parentData['customer']) {
			this.conversationObj.context['skills']['actions skill']['skill_variables']['customer'] = this.parentData['customer'];
		}

		if (this.loggedInUser && this.loggedInUser.id && this.loggedInUser['given_name']) {
			this.conversationObj.context['skills']['actions skill']['skill_variables']['agent'] = {
				"id": this.loggedInUser['id'],
				"name": this.loggedInUser['given_name']
			}
		}

		if (!this.conversationObj.context['skills']['main skill']['user_defined']['initConversation'] &&
          (!this.conversationObj.input.text || this.conversationObj.input.text === '')) {
            return false;
        }

		if (this.conversationObj.context['skills']['main skill']['user_defined']['webhook_result_1']) {
            delete this.conversationObj.context['skills']['main skill']['user_defined']['webhook_result_1'];
        }

		if (this.enableDetection) {
			this.predictions = await this.doPredictions();
			console.log('this.predictions: >>> ', this.predictions);
			if (this.predictions && this.predictions.skill && this.predictions.skill.assistantId
			  && this.predictions.skill.assistantId !== 'COMMON') {
			  this.conversationObj.assistantId = this.predictions.skill.assistantId;
			  console.log('this.conversationObj.assistantId: >>> ', this.conversationObj.assistantId);
			  if (this.sessionMap && this.sessionMap.has(this.predictions.skill.assistantId)) {
				const session = this.sessionMap.get(this.predictions.skill.assistantId);
				if (session && session.sessionId) {
				  this.conversationObj.sessionId = session.sessionId;
				}
			  }else {
				delete this.conversationObj.sessionId;
			  }
			}
		}

		if("domain" in this.parentData && "aa_environmentId" in this.parentData.domain){
			this.conversationObj.environmentId = this.parentData.domain.aa_environmentId;
		}

		const waResponse = await this.assistantService.sendMessage(this.conversationObj).toPromise();
		// console.log('waResponse:  >> ', waResponse);

		if (waResponse && waResponse.context && waResponse['sessionId']) {
            let subscribeToSocket = false;
            if (!this.collectionName || this.collectionName !== waResponse['sessionId'] + '/POST') {
                this.collectionName = '/' + waResponse['sessionId'] + '/POST';
                subscribeToSocket = true;
            }
            if (subscribeToSocket) {
              console.log('Subscribe to Socket: >> ', this.collectionName);
              this.socket.removeAllListeners();
			//   this.collectionName = '/CHAT';
              this.socket.on(this.collectionName, (msg) => {
                console.log('Message received on Socket: >>>', msg);
                this.handleMessageFromWatson(msg);
              });
            }

          }

		await this.handleMessageFromWatson(waResponse);
	}

	scrollToBottom(): void {
        try {
            this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight;
        } catch(err) { }
    }

	async optionSelected(option){
		if(option.label){
			this.userInput.text = option.label;
		}
		if(option.text){
			this.userInput.text = option.text;
		}

		this.sendMessage();
	}

	async suggestionSelected(suggestion){
		if (!suggestion.output || !suggestion.output.generic || suggestion.output.generic.length === 0) {
			console.log('Do Nothing...');
		  } else {
			this.conversations[this.conversations.length - 1].replies[0].output = suggestion.output;
		  }
	}

	async doPredictions(): Promise<any> {
		if (!this.userInput.text || this.userInput.text === '') {
			return;
		}
		const [prediction]: any = await Promise.all([this.predictSkill()]).catch(error => {
		  console.log('ERROR : >>> >', error);
		  return;
		});
		// console.log('SKILL: >>> ', prediction);
		// this.predictions = {'skill': prediction};
		return {'skill': prediction};
	  }

	  async predictSkill(): Promise<any> {
		if (this.userInput && this.userInput.text && this.userInput.text.length > 10) {
			const result = await this.classificationService.predictSkill(this.userInput.text);
			return result;
		}
		return 'None';
	  }


	private async initSTT(){
		const checking = ['audioinput'];
		navigator.mediaDevices.enumerateDevices()
		.then((devices) => {
		devices.forEach((device) => {
			console.log('Device: >> ', device.kind);
			if (device.kind === checking[0]) {
				this.hasAudioDevice = true;
			}
		});
			// console.log('hasAudioDevice: >> ', this.hasAudioDevice);
			if (this.hasAudioDevice) {
				this.fetchSTTToken();
			}
		})
		.catch(function(err) {
		console.log(err.name + ': ' + err.message);
		});
	}

	private async fetchSTTToken(){
		const sttToken = await this.assistantService.fetchSTTToken(this.conversationObj).toPromise();
		this.token = sttToken;
	}

	private async handleMessageFromWatson(msg)  {
		console.log('Conversation API Response: >>> ', msg);
		if (msg) {
		  msg = this.formatOutputResp(msg);
		  this.appendOrPushConversation(msg);
		  this.userInput.text = '';
		  this.conversationObj.input = {
											'text': '',
											'message_type': 'text',
											'options': {'alternate_intents': false, 'return_context': true, debug: false}
										}
		  this.conversationObj.context = msg.context;
		}

		setTimeout(() => {
			this.scrollToBottom()
		}, 400)

	}

	private formatOutputResp(result) {
		result.input.timestamp = this.conversationObj.timestamp;
		result.output.timestamp = new Date();

		if (this.userInput.label) {
		  result.input.text = this.userInput.label;
		}else{
		  result.input.text = this.userInput.text;
		}

		if (result.assistantId && result.sessionId) {
		  this.sessionMap.set(result.assistantId, {'sessionId': result.sessionId});
		  this.conversationObj.assistantId = result.assistantId;
		  this.conversationObj.sessionId = result.sessionId;
		}
		// console.log('In formatOutputResp, sessionMap: >> ', this.sessionMap);
		if(result['output']['generic'] && result['output']['generic'].length > 0){
			result['output']['generic'].forEach(element => {
				console.log(element);
				if(element.response_type == 'search'){
					if(element['primary_results']){
						element['results'] = element['primary_results'];
						delete element['primary_results'];
					}
				}
				// result['output']['generic'].push(element);
			})
		}
		return result;
	  }

	private appendOrPushConversation(msg) {
		if (msg.context && msg.context['skills']['actions skill'] &&
			msg.context['skills']['actions skill']['skill_variables'] &&
			msg.context && msg.context['skills']['actions skill']['skill_variables'].hasOwnProperty('API_CALL')) {
				this.loading['active'] = msg.context['skills']['actions skill']['skill_variables']['API_CALL'];
		}
		if (msg.context && msg.context['skills']['main skill']['user_defined']['next_action']) {
			  if (msg.context['skills']['main skill']['user_defined']['next_action'] === 'append') {
				console.log('IN appendOrPushConversation: >> Context: ', msg.context);
				// console.log(this.conversations[this.conversations.length - 1].replies);
				let reply = this.conversations[this.conversations.length - 1].replies[0];
				if(msg['output']['generic'] && msg['output']['generic'].length > 0){
					msg['output']['generic'].forEach(element => {
						console.log(element);
						if(element.response_type == 'search'){
							if(element['primary_results']){
								element['results'] = element['primary_results'];
								delete element['primary_results'];
							}
						}
						reply['output']['generic'].push(element);
					})
				}
				// reply['output']['generic'].push(msg['output']['generic'])
				// this.conversations.push({'replies': [msg]});
				msg.context['skills']['main skill']['user_defined']['next_action'] = 'completed';
			  }else {
				// this.conversations.push({'replies': [msg]});
			  }

			  this.conversations[this.conversations.length - 1].context = msg.context;

		}else {
			this.conversations.push({'replies': [msg]});
		}

		this.checkParentUpdates(msg);
		// this.checkCustomerInfo(msg);
		// console.log("Total Conversations: >>> ", this.conversations);
	}

	private checkParentUpdates(msg){
		if(msg.context['skills'] && msg.context['skills']['actions skill'] && msg.context['skills']['actions skill']['skill_variables']){
			const skillVariables = msg.context['skills']['actions skill']['skill_variables'];
			let sentiment = "Neutral";
			let parentData: any = {
				'sentiment': sentiment
			}
			if('sentiment' in skillVariables){
				parentData['sentiment'] = skillVariables['sentiment'];
			}
			if('SUPPORT_STATUS' in skillVariables){
				parentData['SUPPORT_STATUS'] = skillVariables['SUPPORT_STATUS'];
			}

			this.updateParentEvent.emit(parentData);
		}
	}

	setSTTOptions(token: string): RecognizeStream {
		return {
		  file: "../../../../../assets/audios/techSupport1.mp3",
		  play: true,
		  realtime: true,
		  accessToken: token,
		  format: true,
		  extractResults: true,
		  objectMode: true,
		  model: 'en-US_NarrowbandModel',
		//   model: 'en-IN_Telephony',
		//   resultsBySpeaker: true
		};
	}

	async startStream() {
	//   console.log('IN startStream: >>  token:  ', this.token);
	  this.isStreaming = true;
	//   this.stream = recognizeMicrophone(this.setSTTOptions(this.token['access_token']));
	  this.stream = recognizeFile(this.setSTTOptions(this.token['access_token']));
	  this.ngZone.runOutsideAngular(() => {
		this.stream.on('data', data => {
		  this.ngZone.run(() => {
			// this.userInput.text = data.alternatives[0].transcript;
			// callTranscript.push(data.alternatives[0].transcript);
			// this.conversationObj.params.input.text = data.alternatives[0].transcript;
			// console.log(data);

			if (data.final) {
			//   this.stopStream();
				this.callTranscript.push(data);
				console.log("Stream Data: >> ", data);
			}
		  });
		});

		this.stream.on('error', error => {
		  this.ngZone.run(() => {
			console.log(error);
			this.stopStream();
		  });
		});

	  });

	}

	async stopStream() {
		console.log('IN stopStream: >>>> ');
		if (this.stream) {
		  this.isStreaming = false;
		  this.stream.stop();
		  console.log("Final Transcript: >> ", this.callTranscript);
		  this.sendMessage();
		}
	}

	openPDF(resultData){
		// console.log("IN openPDF with resultData: >> ", resultData);
		let fileName = "";
		if(resultData['highlight'] && resultData['highlight']['extracted_metadata.filename']){
			fileName = resultData['highlight']['extracted_metadata.filename'][0];
		}else{
			return false;
		}

		const pdfURL = "/assets/docs/"+fileName;
		const contentData: any = {
			'show': true,
			'url': pdfURL,
			'metadata': resultData.result_metadata,
			'highlight': resultData.highlight,
			'body': resultData.body
		}
		this.showContent.emit(contentData);
	}


}
