import { Component, ViewEncapsulation, OnInit } from '@angular/core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	encapsulation: ViewEncapsulation.None
})
export class AppComponent implements OnInit {

	cognosUrl: string;
  	loadCognosApi: Promise<any>;

	constructor(

		) {

	}

	ngOnInit(): void {
		console.log('IN AppComponent init method: >>>>');
	}

}
