import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Injectable()
export class AssistantService {

    httpHeaders: HttpHeaders;

	constructor(private http: HttpClient) {
	}

    refreshHeaders() {
        const userToken = localStorage.getItem(environment.authTokenKey);
        this.httpHeaders = new HttpHeaders({
          'Content-Type': 'application/json; charset=UTF-8',
        //   'Accept': 'application/json',
          'Authorization': userToken ? userToken : ''
        });

        return this.httpHeaders;
    }

	fetchSTTToken(payload): Observable<any> {
		console.log('IN AssistantService.fetchSTTToken METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.get<any>(environment.BACKEND_API_URL + '/api/speech/stt_token', { headers: this.httpHeaders });
	}

	synthesize(payload): Observable<any> {
		console.log('IN AssistantService.synthesize METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		this.httpHeaders.set("Accept", "application/octet-stream");
		const options: any = {headers: this.httpHeaders};
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/speech/tts/synthesize', payload, { ...options, observe: 'response', responseType: 'arraybuffer'});
	}

	sendMessage(payload): Observable<any> {
		console.log('IN AssistantService.sendMessage METHOD: >>>> ', payload);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/assistant/pre',
			payload, { headers: this.httpHeaders });
	}

}
