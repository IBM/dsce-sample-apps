import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { IconService } from 'carbon-components-angular';

import Notification20 from '@carbon/icons/es/notification/20';
import UserAvatar20 from '@carbon/icons/es/user--avatar/20';
import Switcher20 from '@carbon/icons/es/switcher/20';
import Filter16 from '@carbon/icons/es/filter/16';
import Save16 from '@carbon/icons/es/save/16';
import Download16 from '@carbon/icons/es/download/16';
import Add16 from '@carbon/icons/es/add/16';
import Dashboard16 from '@carbon/icons/es/dashboard/16';
import Building16 from '@carbon/icons/es/building/16';
import IoTConnect16 from '@carbon/icons/es/iot--connect/16';
import Rule16 from '@carbon/icons/es/rule/16';
import Settings16 from '@carbon/icons/es/settings/16';
import Carbon16 from '@carbon/icons/es/carbon/16';
import Watson16 from '@carbon/icons/es/watson/16';
import Home16 from '@carbon/icons/es/home/16';
import Apps16 from '@carbon/icons/es/apps/16';
import Edit16 from '@carbon/icons/es/edit/16';
import Reset16 from '@carbon/icons/es/reset/16';
import Event16 from '@carbon/icons/es/event/16';
import CloudDownload16 from '@carbon/icons/es/cloud--download/16';
import AppConnectivity16 from '@carbon/icons/es/app-connectivity/16';
import Renew16 from '@carbon/icons/es/renew/16';
import AIStatus16 from '@carbon/icons/es/watson-health/ai-status/16';
import Chat16 from '@carbon/icons/es/chat/16';
import ChatLaunch16 from '@carbon/icons/es/chat--launch/16';
import Fade16 from '@carbon/icons/es/fade/16';
import LogoGithub16 from '@carbon/icons/es/logo--github/16';
// import Delete16 from '@carbon/icons/es/delete/16';
import Close16 from '@carbon/icons/es/close/16';
import Send16 from '@carbon/icons/es/send/16';
import SendFilled16 from '@carbon/icons/es/send--filled/16';
import Microphone16 from '@carbon/icons/es/microphone/16';
import MicrophoneFilled16 from '@carbon/icons/es/microphone--filled/16';
import Restart16 from '@carbon/icons/es/restart/16';
import TaskRemove16 from '@carbon/icons/es/task--remove/16';
import HelpDesk from '@carbon/icons/es/help-desk/16';
import Headset from '@carbon/icons/es/headset/16';
import ChartEvaluation from '@carbon/icons/es/chart--evaluation/16';
import IBMWatsonAssistant from '@carbon/icons/es/ibm-watson--assistant/16';
import NextOutlined from '@carbon/icons/es/next--outline/16';
import NextFilled from '@carbon/icons/es/next--filled/16';
import DocumentView from '@carbon/icons/es/document--view/16';
import Currency from '@carbon/icons/es/currency/16';
import Information from '@carbon/icons/es/information/16';
import Application from '@carbon/icons/es/application/16';
import AppConnectivity from '@carbon/icons/es/app-connectivity/16';

import { Subject } from 'rxjs';
import { CommonService } from 'src/app/services';
// import '@carbon/charts/styles.css';


@Component({
	selector: 'app-base',
	templateUrl: './base.component.html',
	styleUrls: ['./base.component.scss']
})
export class BaseComponent implements OnInit {

	selfLayout = 'default';

	// @Output() notifyHeader: EventEmitter<any> = new EventEmitter();
	headerEvents:Subject<any> = new Subject();

	constructor( protected iconService: IconService, private commonService: CommonService) {
		iconService.registerAll([
			Notification20,
			UserAvatar20,
			Switcher20,
			Filter16,
			Save16,
			Download16,
			Add16,
			Dashboard16,
			Building16,
			IoTConnect16,
			Rule16,
			Settings16,
			Carbon16,
			Watson16,
			Home16,
			Apps16,
			Edit16,
			Reset16,
			Event16,
			CloudDownload16,
			AppConnectivity16,
			Renew16,
			AIStatus16,
			Chat16,
			ChatLaunch16,
			Fade16,
			LogoGithub16,
			Close16,
			Send16,
			SendFilled16,
			Microphone16,
			MicrophoneFilled16,
			Restart16,
			TaskRemove16,
			HelpDesk,
			Headset,
			ChartEvaluation,
			IBMWatsonAssistant,
			NextOutlined,
			NextFilled,
			DocumentView,
			Currency,
			Information,
			Application,
			AppConnectivity
		  ]);
	 }

	ngOnInit(): void {
		let eventObj = {
			"leftPanelActive": false
		}
		console.log("IN BaseComponent.init: >> ", eventObj);
		this.commonService.setHeaderEvent(this.headerEvents);
		this.commonService.emitHeaderEvent(eventObj);
		// this.headerEvents.next(eventObj);
	}

	onClick(event) {
		var target = event.target || event.srcElement || event.currentTarget;
		let eventObj = {
			"leftPanelActive": false
		}
		if (document.getElementById('main-content').contains(target)){
		//   console.log('CLICKED IN MAIN CONTENT AREA', target);
			eventObj.leftPanelActive = false;
			this.commonService.emitHeaderEvent(eventObj);
		} else{
		//   console.log('CLICKED OUTSIDE MAIN CONTENT AREA', target);
			this.commonService.emitHeaderEvent(eventObj);
		}
	}

}
