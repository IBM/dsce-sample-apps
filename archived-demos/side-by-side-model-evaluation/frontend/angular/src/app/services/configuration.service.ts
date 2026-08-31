import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AppConfig } from '../models';

@Injectable()
export class ConfigurationService {

    httpHeaders: HttpHeaders;

	constructor(private http: HttpClient) {
	}

    refreshHeaders() {
        const userToken = localStorage.getItem(environment.authTokenKey);
        this.httpHeaders = new HttpHeaders({
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
          'Authorization': userToken ? userToken : ''
        });
        
        return this.httpHeaders;
    }

	findApplications(payload: any): Observable<any> {
		console.log('IN ConfigurationService.findApplications METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.get<any>(environment.BACKEND_API_URL + '/api/application', { headers: this.httpHeaders });
	}

	createApplication(payload: any): Observable<any> {
		console.log('IN ConfigurationService.createApplication METHOD: >>>> ', payload);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/application',
			payload, { headers: this.httpHeaders });
	}

    createConfig(config: any): Observable<any> {
		if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/app-config',
            config, { headers: this.httpHeaders });
	}

    updateConfig(_config: AppConfig): Observable<any> {
        if (!this.httpHeaders) {
            this.refreshHeaders();
        }
        return this.http.patch(environment.BACKEND_API_URL + '/api/app-config/' +_config.id, _config, { headers: this.httpHeaders });
    }

    findConfig(queryParams: any): Observable<any> {
		
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
        let httpParams: HttpParams;
        if(queryParams && queryParams.filter){
            httpParams = new HttpParams().set('filter', JSON.stringify(queryParams.filter));          
        }else{
            httpParams = new HttpParams();
        }
        return this.http.get<any>(environment.BACKEND_API_URL + '/api/app-config', { headers: this.httpHeaders, params: httpParams });
	}

    deleteConfig(configId: string) {
        const url = environment.BACKEND_API_URL + '/api/app-config/' + configId;
        return this.http.delete(url);
    }

    makeDefaultApp(payload: any): Observable<any> {
		if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/application/default',
            payload, { headers: this.httpHeaders });
	}

    getDefaultAppId(): Observable<any> {
		if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.get<any>(environment.BACKEND_API_URL + '/api/application/default',
            { headers: this.httpHeaders });
	}

	
}
