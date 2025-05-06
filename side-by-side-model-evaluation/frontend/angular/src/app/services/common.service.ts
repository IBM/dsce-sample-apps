import { Injectable } from '@angular/core';
// import { BehaviorSubject } from 'rxjs/BehaviorSubject';
// import { Http, Response, RequestOptions, Headers } from '@angular/http';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Subject } from 'rxjs';
// import { EncryptService } from './encrypt.service';

const httpHeaders = new HttpHeaders();
		httpHeaders.set('Accept', 'application/json');
		httpHeaders.set('Content-Type', 'application/json');

@Injectable({
	providedIn: 'root',
})
export class CommonService {

	private cache = {};
	// headerEvents:Subject<any> = new BehaviorSubject(true);
	headerEvents:Subject<any> = new Subject();

	constructor(private http: HttpClient) {
	}

	public getCache(){
		return this.cache;
	}

	setHeaderEvent(headerEvents){
		this.headerEvents = headerEvents;
	}

	emitHeaderEvent(eventObj){
		this.headerEvents.next(eventObj);
	}

}
