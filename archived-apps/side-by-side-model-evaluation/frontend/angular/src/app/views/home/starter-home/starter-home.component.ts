import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonService } from 'src/app/services';

@Component({
	selector: 'app-starter-home',
	templateUrl: './starter-home.component.html',
	styleUrls: ['./starter-home.component.scss']
})
export class StarterHomeComponent implements OnInit, OnDestroy {

	constructor(private commonService: CommonService) {
	}

	ngOnInit(): void {
		console.log("<<<<<< IN StarterHomeComponent >>>>>>> ");
		let eventObj = {
			"leftPanelActive": false,
			"showLeftPanel": true
		}
		this.commonService.emitHeaderEvent(eventObj);

	}

	ngOnDestroy(): void {
		// throw new Error('Method not implemented.');
	}



}
