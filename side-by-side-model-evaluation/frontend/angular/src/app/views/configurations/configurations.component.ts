import { Component, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { select, Store } from '@ngrx/store';
import { TableHeaderItem, TableItem, TableModel } from 'carbon-components-angular';
import { Observable } from 'rxjs';
import { currentUser, User } from 'src/app/core/auth';
import { AppState } from 'src/app/core/reducers';
import { AppConfig, Assistant } from 'src/app/models';
import { ConfigurationService } from 'src/app/services';
import { environment } from 'src/environments/environment';


export enum PageContent {
	WA = 'WA',
	WD = 'WD',
	WSTT = 'WSTT',
	CHANNELS = 'CHANNELS'
  }

@Component({
	selector: 'configurations',
	templateUrl: './configurations.component.html',
	styleUrls: ['./configurations.component.scss']
})
export class ConfigurationsComponent implements OnInit, OnDestroy {

	user$: Observable<User>;
	loggedInUser: any
	offset =  { x: -118, y: 49 };
	showContent: PageContent = PageContent.WA;
	applications: any;
	configurations: any;
	selectedAppId: any;
	defaultAppId: any;

	appConfig: AppConfig;
	showAddAssistant: boolean = false;
	waForm: FormGroup;
	watsonForm: FormGroup;
	hasWAFormErrors: boolean = false;
	hasWatsonFormErrors: boolean = false;
	assistantsData: TableModel;
	assistant: Assistant;
	assistantsTableConfig: any = {
		size: "md",
		title: "Assistants",
		searchModel: "Search Assistants",
		showSelectionColumn: true,
		enableSingleSelect: false,
		striped: true,
		sortable: true,
		isDataGrid: false,
		stickyHeader: false,
		skeleton: true,
		offset:  { x: 0, y: 50 },
		batchText: {
			SINGLE: "1 item selected",
			MULTIPLE: "{{count}} items selected"
		}
	};

	wdForm: FormGroup;
	hasWDFormErrors: boolean = false;

	wsttForm: FormGroup;
	hasWSTTFormErrors: boolean = false;

	channelsForm: FormGroup;
	hasChannelsFormErrors: boolean = false;

	@ViewChild('editAssistantLink', { read: TemplateRef }) editAssistantLink:TemplateRef<any>;
	@ViewChild("assistantsActionsTemplate", { static: false }) protected assistantsActionsTemplate: TemplateRef<any>;

	constructor(
		private store: Store<AppState>,
		private configurationService: ConfigurationService,
		private waFB: FormBuilder,
		private watsonFB: FormBuilder,
		private wdFB: FormBuilder,
		private wsttFB: FormBuilder,
		private channelsFB: FormBuilder,
	) {
	}

	ngOnInit(): void {
		console.log('IN ConfigurationsComponent.ngOnInit >>>> ');
		this.user$ = this.store.pipe(select(currentUser));
		this.user$.subscribe(async u => {
			this.loggedInUser = u;
			await this.fetchApplications();
		});
	}

	ngOnDestroy(): void {
		console.log('IN ConfigurationsComponent.ngOnDestroy >>>> ');;
	}

	async fetchApplications(){
		const defaultAppIdResp = await this.configurationService.getDefaultAppId().toPromise();
		if(defaultAppIdResp && defaultAppIdResp['defaultAppId']){
			this.defaultAppId = defaultAppIdResp['defaultAppId'];
		}
		const resp = await this.configurationService.findApplications({}).toPromise();
		if(resp && resp.items){
			this.applications = [];
			// this.applications = resp.items;
			resp.items.forEach(async element => {
				let application: any = {
					id: element.id,
					content: element.title,
					tenantId: element.tenantId
				}
				this.applications.push(application);
			});
		}

		if(this.applications && this.applications.length > 0){
			this.applications.forEach(async application => {
				if(application.id == this.defaultAppId){
					application['selected'] = true;
					this.selectedAppId = application.id;
					await this.fetchConfigurations();
					this.showPageContent(PageContent.WA);
					console.log('DefaultApp is: >> ', application);
				}
			});
		}

	}

	async fetchConfigurations(){
		console.log('selectedAppId: >> ', this.selectedAppId);
		const params = {
			"filter": {
				"where": {
					"applicationId": this.selectedAppId
				  }
			}

		}
		const resp = await this.configurationService.findConfig(params).toPromise();
		this.configurations = new Map();
		if(resp && resp.items){
			resp.items.forEach(element => {
				this.configurations[element.key] = element;
				// console.log(this.configurations[element.key]);
			});
		}

		localStorage.setItem("configurations", JSON.stringify(this.configurations));

	}

	editApplication(){

	}

	showPageContent(content: any){
		this.showContent = content;

		if(this.showContent == PageContent.WA){
			if(this.configurations['WA_CONFIG']){
				this.appConfig = this.configurations['WA_CONFIG'];
			}else{
				this.appConfig = new AppConfig();
				this.appConfig.tenantId = environment.tenantId,
				this.appConfig.applicationId = this.selectedAppId,
				this.appConfig.key = "WA_CONFIG",
				this.appConfig.config = {
						"IS_CP4D": false,
						"ENABLE_SKILLS_DETECTION": false,
						"API_KEY": "",
						"SERVICE_URL": "",
						"ASSISTANTS": []
					}

				this.configurations['WA_CONFIG'] = this.appConfig;
			}
			this.createWAForm();
			this.populateAssistantsTable();
		}

		if(this.showContent == PageContent.WD){
			if(this.configurations['WD_CONFIG']){
				this.appConfig = this.configurations['WD_CONFIG'];
			}else{
				this.appConfig = new AppConfig();
				this.appConfig.tenantId = environment.tenantId,
				this.appConfig.applicationId = this.selectedAppId,
				this.appConfig.key = "WD_CONFIG",
				this.appConfig.config = {
						"IS_CP4D": false,
						"ENABLE": false,
						"API_KEY": "",
						"SERVICE_URL": "",
						"PROJECT_ID": "",
					}
				this.configurations['WD_CONFIG'] = this.appConfig;
			}
			this.createWDForm();
		}

		if(this.showContent == PageContent.WSTT){
			if(this.configurations['WSTT_CONFIG']){
				this.appConfig = this.configurations['WSTT_CONFIG'];
			}else{
				this.appConfig = new AppConfig();
				this.appConfig.tenantId = environment.tenantId,
				this.appConfig.applicationId = this.selectedAppId,
				this.appConfig.key = "WSTT_CONFIG",
				this.appConfig.config = {
						"IS_CP4D": false,
						"ENABLE": false,
						"STT_API_KEY": "",
						"STT_ENDPOINT": "https://api.us-south.speech-to-text.watson.cloud.ibm.com",
						"STT_CUSTOMIZATION_ID": "",
						"STT_MODEL": "en-US_BroadbandModel"
					}
				this.configurations['WSTT_CONFIG'] = this.appConfig;
				console.log("WSTT_CONFIG: >> ", this.configurations['WSTT_CONFIG']);
			}
			this.createWSTTForm();
		}

		if(this.showContent == PageContent.CHANNELS){
			if(this.configurations['CHANNELS_CONFIG']){
				this.appConfig = this.configurations['CHANNELS_CONFIG'];
			}else{
				this.appConfig = new AppConfig();
				this.appConfig.tenantId = environment.tenantId,
				this.appConfig.applicationId = this.selectedAppId,
				this.appConfig.key = "CHANNELS_CONFIG",
				this.appConfig.config = {
						"ENABLE_SLACK": false,
						"SLACK_BOT_USER_TOKEN": "",
						"SLACK_SIGNIN_SECRET": ""
					}
				this.configurations['CHANNELS_CONFIG'] = this.appConfig;
			}
			this.createChannelsForm();
		}

	}

	async applicationSelected(event){
		if(event.item){
			if(this.defaultAppId != event.item.id){
				this.defaultAppId = event.item.id;
				// console.log('IN applicationSelected: >> ', this.selectedAppId);
				await this.fetchConfigurations();
				this.showPageContent(PageContent.WA);
			}
		}
		// console.log('IN applicationSelected: >> ', this.defaultAppId, ', event: ', event.item);
	}

	async makeDefaultApp(){
		console.log('IN makeDefaultApp: >> ', this.defaultAppId);
		const payload = {
			"applicationId": this.defaultAppId
		}
		if(payload && payload.applicationId){
			await this.configurationService.makeDefaultApp(payload).toPromise();
		}
	}

	createWAForm() {
		this.waForm = this.waFB.group({
			WA_CP4D: [this.appConfig['config']['IS_CP4D']],
			ENABLE_SKILLS_DETECTION: [this.appConfig['config']['ENABLE_SKILLS_DETECTION']],
			API_KEY: [this.appConfig['config']['API_KEY'], Validators.required],
			SERVICE_URL: [this.appConfig['config']['SERVICE_URL'], Validators.required],
		});
		this.initAssistantsTable();
	}

	createWatsonForm() {
		console.log('IN createWatsonForm: >> ', this.assistant);
		this.watsonForm = this.watsonFB.group({
			id: [this.assistant.id, Validators.required],
			ss_environmentId: [this.assistant.ss_environmentId],
			aa_environmentId: [this.assistant.aa_environmentId],
			name: [this.assistant.name, Validators.required],
			default: [this.assistant.default]
		});
	}

	async addAssistant(){
		console.log('IN addAssistant: >> ');
		this.assistant = Object.assign({}, new Assistant());
		this.createWatsonForm();
		this.showAddAssistant = true;
	}

	cancelAddAssistant(){
		console.log('IN cancelAddAssistant: >> ', this.assistant);
		this.hasWatsonFormErrors = false;
		this.watsonForm.markAsPristine();
        this.watsonForm.markAsUntouched();
        this.watsonForm.updateValueAndValidity();
		this.populateAssistantsTable();
		this.showAddAssistant = false;
	}

	saveAssistant(){
		try {
			this.hasWatsonFormErrors = false;
			const controls = this.watsonForm.controls;
			/** check form */
			if (this.watsonForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasWatsonFormErrors = true;
				console.log('Form has errors: >> ', this.hasWatsonFormErrors);
				return;
			}

			const _assistant = new Assistant();
			_assistant.clear();
			_assistant.id = controls['id'].value;
			_assistant.aa_environmentId = controls['aa_environmentId'].value;
			_assistant.ss_environmentId = controls['ss_environmentId'].value;
			_assistant.name = controls['name'].value;
			_assistant.default = controls['default'].value;;

			if(this.assistant.id){
				for (let assistant of this.appConfig['config']['ASSISTANTS']) {
					if(_assistant.default){
						assistant.default = false;
					}
					if(assistant.id == this.assistant.id){
						Object.assign(assistant, _assistant);
					}
				}
			}else{
				for (let assistant of this.appConfig['config']['ASSISTANTS']) {
					if(_assistant.default){
						assistant.default = false;
					}
				}
				this.appConfig['config']['ASSISTANTS'].push(_assistant);
			}

			// console.log('IN saveAssistant: >> ', this.waConfig['config']['ASSISTANTS']);

		} catch (e) {
			console.log(e);
		}

		this.assistant = null;
		this.populateAssistantsTable();
		this.showAddAssistant = false;
	}

	editAssistant(clickedAssistant: any){
		console.log('IN editAssistant: >> ', clickedAssistant);
		this.assistant = clickedAssistant;
		this.createWatsonForm();
		this.showAddAssistant = true;
	}

	deleteAssistant(clickedAssistant: any){
		console.log('IN deleteAssistant: >> ', clickedAssistant);
		this.appConfig['config']['ASSISTANTS'] = this.appConfig['config']['ASSISTANTS'].filter(item=>item.id != clickedAssistant.id );
		this.populateAssistantsTable();
	}

	makeDefaultAssistant(clickedAssistant: any){
		console.log('IN makeDefaultAssistant: >> ', clickedAssistant);
		for (let assistant of this.appConfig['config']['ASSISTANTS']) {
			if(assistant.id == clickedAssistant.id){
				assistant.default = true;
			}else{
				assistant.default = false;
			}
		}
		this.populateAssistantsTable();
	}

	private initAssistantsTable(){
		this.assistantsData = new TableModel();
		let actionsCol = new TableHeaderItem({data: ""});
		actionsCol.className = 'actionsCol';
		actionsCol.style = {"width": "5px", "text-align": "right"};
		actionsCol.sortable = false;
		this.assistantsData.header = [
			new TableHeaderItem({data: "Id" }),
			// new TableHeaderItem({data: "AA_AssitantId" }),
			new TableHeaderItem({data: "Name" }),
			new TableHeaderItem({data: "IsDefault" }),
			actionsCol
		];
	}

	private populateAssistantsTable(){
		this.assistantsData.data = [];
		if(this.appConfig && this.appConfig['config'] && this.appConfig['config']['ASSISTANTS']){
			for (const assistant of this.appConfig['config']['ASSISTANTS']) {
				this.assistantsData.addRow([
						new TableItem({data: assistant, template: this.editAssistantLink}),
						new TableItem({data: assistant.name}),
						new TableItem({data: assistant.default}),
						new TableItem({data: assistant, template: this.assistantsActionsTemplate}),
					]
				);
			}

			this.assistantsTableConfig.skeleton = false;
		}

	}

	rowClicked(index){
		// console.log('In rowClicked: >> ', index);
		// console.log(this.devicesData.data.values()[index].next().value[index]);
		const item = this.assistantsData.row(index);
		// let selectedAssistant = item[0]["data"];
	}

	cancelMethod(){
		console.log('IN Cancel Method');
	}

	async resetForm(){
		if(!this.appConfig){
			this.appConfig = Object.assign({}, new AppConfig());
		}
		this.reset();
		await this.fetchApplications();
	}

	reset() {
		// this.waConfig = Object.assign({}, {});
		this.createWAForm();
		this.hasWAFormErrors = false;
		this.waForm.markAsPristine();
        this.waForm.markAsUntouched();
        this.waForm.updateValueAndValidity();
	}

	saveWAConfig() {
		try {
			console.log('IN saveWAConfig, ')
			this.hasWAFormErrors = false;
			const controls = this.waForm.controls;
			/** check form */
			if (this.waForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasWAFormErrors = true;
				console.log('Form has errors: >> ', this.hasWAFormErrors);
				return;
			}

			const configToSave = this.prepareWAConfig();
			this.saveConfig(configToSave);
		} catch (e) {
			console.log(e);
		}
	}

	/**
	 * Returns prepared data for save
	 */
	 private prepareWAConfig(): any {
		const controls = this.waForm.controls;
		const _config = new AppConfig();
		_config.clear();
		_config.id = this.appConfig.id;
		_config.tenantId = this.appConfig.tenantId;
		_config.applicationId = this.appConfig.applicationId;
		_config.key = this.appConfig.key;
		_config.config = this.appConfig.config;
		_config.config["IS_CP4D"] = controls['WA_CP4D'].value;
		_config.config["ENABLE_SKILLS_DETECTION"] = controls['ENABLE_SKILLS_DETECTION'].value;
		_config.config["API_KEY"] = controls['API_KEY'].value;
		_config.config["SERVICE_URL"] = controls['SERVICE_URL'].value;
		return _config;
	}

	createWDForm() {
		this.wdForm = this.wdFB.group({
			ENABLE: [this.appConfig['config']['ENABLE']],
			WD_CP4D: [this.appConfig['config']['IS_CP4D']],
			API_KEY: [this.appConfig['config']['API_KEY'], Validators.required],
			SERVICE_URL: [this.appConfig['config']['SERVICE_URL'], Validators.required],
			PROJECT_ID: [this.appConfig['config']['PROJECT_ID'], Validators.required],
		});
	}

	saveWDConfig() {
		try {
			console.log('IN saveWDConfig, ')
			this.hasWDFormErrors = false;
			const controls = this.wdForm.controls;
			/** check form */
			if (this.wdForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasWDFormErrors = true;
				console.log('Form has errors: >> ', this.hasWDFormErrors);
				return;
			}

			const configToSave = this.prepareWDConfig();
			this.saveConfig(configToSave);
		} catch (e) {
			console.log(e);
		}
	}

	private prepareWDConfig(): any {
		const controls = this.wdForm.controls;
		const _config = new AppConfig();
		_config.clear();
		_config.id = this.appConfig.id;
		_config.tenantId = this.appConfig.tenantId;
		_config.applicationId = this.appConfig.applicationId;
		_config.key = this.appConfig.key;
		_config.config = this.appConfig.config;
		_config.config["ENABLE"] = controls['ENABLE'].value;
		_config.config["IS_CP4D"] = controls['WD_CP4D'].value;
		_config.config["API_KEY"] = controls['API_KEY'].value;
		_config.config["SERVICE_URL"] = controls['SERVICE_URL'].value;
		_config.config["PROJECT_ID"] = controls['PROJECT_ID'].value;
		return _config;
	}

	createWSTTForm() {
		this.wsttForm = this.wsttFB.group({
			ENABLE: [this.appConfig['config']['ENABLE']],
			WSTT_CP4D: [this.appConfig['config']['IS_CP4D']],
			STT_API_KEY: [this.appConfig['config']['STT_API_KEY'], Validators.required],
			STT_ENDPOINT: [this.appConfig['config']['STT_ENDPOINT'], Validators.required],
			STT_CUSTOMIZATION_ID: [this.appConfig['config']['STT_CUSTOMIZATION_ID']],
			STT_MODEL: [this.appConfig['config']['STT_MODEL']]
		});
	}

	saveWSTTConfig() {
		try {
			console.log('IN saveWSTTConfig, ')
			this.hasWSTTFormErrors = false;
			const controls = this.wsttForm.controls;
			/** check form */
			if (this.wsttForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasWSTTFormErrors = true;
				console.log('Form has errors: >> ', this.hasWSTTFormErrors);
				return;
			}

			const configToSave = this.prepareWSTTConfig();
			this.saveConfig(configToSave);
			this.resetForm();
		} catch (e) {
			console.log(e);
		}
	}

	private prepareWSTTConfig(): any {
		const controls = this.wsttForm.controls;
		const _config = new AppConfig();
		_config.clear();
		_config.id = this.appConfig.id;
		_config.tenantId = this.appConfig.tenantId;
		_config.applicationId = this.appConfig.applicationId;
		_config.key = this.appConfig.key;
		_config.config = this.appConfig.config;
		_config.config["ENABLE"] = controls['ENABLE'].value;
		_config.config["IS_CP4D"] = controls['WSTT_CP4D'].value;
		_config.config["STT_API_KEY"] = controls['STT_API_KEY'].value;
		_config.config["STT_ENDPOINT"] = controls['STT_ENDPOINT'].value;
		_config.config["STT_CUSTOMIZATION_ID"] = controls['STT_CUSTOMIZATION_ID'].value;
		_config.config["STT_MODEL"] = controls['STT_MODEL'].value;

		return _config;
	}

	createChannelsForm() {
		this.channelsForm = this.channelsFB.group({
			ENABLE_SLACK: [this.appConfig['config']['ENABLE_SLACK']],
			SLACK_BOT_USER_TOKEN: [this.appConfig['config']['SLACK_BOT_USER_TOKEN'], Validators.required],
			SLACK_SIGNIN_SECRET: [this.appConfig['config']['SLACK_SIGNIN_SECRET'], Validators.required],
		});
	}

	saveChannelsConfig() {
		try {
			console.log('IN saveChannelsConfig, ')
			this.hasChannelsFormErrors = false;
			const controls = this.channelsForm.controls;
			/** check form */
			if (this.channelsForm.invalid) {
				Object.keys(controls).forEach(controlName =>
					controls[controlName].markAsTouched()
				);

				this.hasChannelsFormErrors = true;
				console.log('Form has errors: >> ', this.hasChannelsFormErrors);
				return;
			}

			const configToSave = this.prepareChannelsConfig();
			this.saveConfig(configToSave);
			this.resetForm();
		} catch (e) {
			console.log(e);
		}
	}

	private prepareChannelsConfig(): any {
		const controls = this.channelsForm.controls;
		const _config = new AppConfig();
		_config.clear();
		_config.id = this.appConfig.id;
		_config.tenantId = this.appConfig.tenantId;
		_config.applicationId = this.appConfig.applicationId;
		_config.key = this.appConfig.key;
		_config.config = this.appConfig.config;
		_config.config["ENABLE_SLACK"] = controls['ENABLE_SLACK'].value;
		_config.config["SLACK_BOT_USER_TOKEN"] = controls['SLACK_BOT_USER_TOKEN'].value;
		_config.config["SLACK_SIGNIN_SECRET"] = controls['SLACK_SIGNIN_SECRET'].value;
		return _config;
	}

	/**
	 * Save Config
	 *
	 * @param _config: AppConfig
	 */
	 private saveConfig(_config: AppConfig) {
		console.log('IN saveConfig, config: >>>> ', _config);
		let resp: any;
		if(_config.id){
			resp = this.configurationService.updateConfig(_config).toPromise();
		}else{
			resp = this.configurationService.createConfig(_config).toPromise();
		}

		return resp;

	}

}
