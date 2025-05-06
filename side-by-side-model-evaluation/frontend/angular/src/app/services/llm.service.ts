import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { RagConfig } from '../models/rag_config.model';

@Injectable()
export class LLMService {

    httpHeaders: HttpHeaders;

	constructor(private http: HttpClient) {
	}

    refreshHeaders() {
        const userToken = localStorage.getItem(environment.authTokenKey);
        this.httpHeaders = new HttpHeaders({
          'Content-Type': 'application/json; charset=UTF-8',
          'Accept': 'application/json',
        //   'Authorization': userToken ? userToken : '',
		  'X-API-Key': environment.BACKEND_API_KEY
        });

        return this.httpHeaders;
    }

	refreshTokens(): Observable<any> {
		console.log('IN LLMService.refreshTokens METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		// this.httpHeaders.set("X-API-Key", environment.BACKEND_API_KEY);
		console.log(environment.BACKEND_API_KEY);
		return this.http.get<any>(environment.BACKEND_API_URL + '/api/watsonx/refresh', { headers: this.httpHeaders });
	}

	fetchIBMLLMSpecs(): Observable<any> {
		console.log('IN LLMService.fetchIBMLLMSpecs METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		// this.httpHeaders.set("X-API-Key", environment.BACKEND_API_KEY);
		console.log(environment.BACKEND_API_KEY);
		return this.http.get<any>(environment.BACKEND_API_URL + '/api/watsonx/foundation_model_specs', { headers: this.httpHeaders });
	}

	fetchExternalLLMSpecs(external_api_key): Observable<any> {
		console.log('IN LLMService.fetchExternalLLMSpecs METHOD: >>>> ');
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }

		let endpoint = environment.BACKEND_API_URL + '/api/openai/foundation_model_specs';
		if(external_api_key && external_api_key.length > 10){
			endpoint = endpoint + "?apikey="+external_api_key
		}

		return this.http.get<any>(endpoint, { headers: this.httpHeaders });
	}

	loadDocuments(payload: any): Observable<any> {
		console.log('IN LLMService.loadDocuments METHOD: >>>> ', payload);
		const formData = new FormData();
		for(const file of payload["files"]){
			formData.append("files", file);
		}
		formData.append("data", JSON.stringify(payload["ragConfig"]));

		const multipartHeaders = new HttpHeaders({
			'Accept': 'application/json',
		  	'X-API-Key': environment.BACKEND_API_KEY
		  });

		return this.http.post(environment.BACKEND_API_URL + '/api/rag/upload',
			formData, { headers: multipartHeaders });
	}

	parseDocuments(payload: any): Observable<any> {
		console.log('IN LLMService.parseDocuments METHOD: >>>> ', payload);

		if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }

		return this.http.post(environment.BACKEND_API_URL + '/api/rag/load',
			payload, { headers: this.httpHeaders });
	}

	fetchTaskStatus(taskId: any): Observable<any> {
		console.log('IN LLMService.fetchTaskStatus METHOD: >>>> ', taskId);

		if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }

		return this.http.get(environment.BACKEND_API_URL + '/api/tasks/'+taskId,
			{ headers: this.httpHeaders });
	}

	fetchCollections(ragConfig: any): Observable<any> {
		console.log('IN LLMService.fetchCollections METHOD: >>>> ', ragConfig);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/rag/collections',
			ragConfig, { headers: this.httpHeaders });
	}

	deleteCollection(dbName: string, collectionName: string): Observable<any> {
		console.log('IN LLMService.deleteCollections dbName: >>>> ', dbName, ", collectionName: ", collectionName);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.delete<any>(environment.BACKEND_API_URL + '/api/rag/collections/'+dbName+"/"+collectionName,
			{ headers: this.httpHeaders });
	}

	fetchContext(payload: any): Observable<any> {
		console.log('IN LLMService.fetchContext METHOD: >>>> ', payload);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/rag/fetch_context',
			payload, { headers: this.httpHeaders });
	}

	async generateUsingWatsonx(payload: any) {
		return new Observable<any>((observer) => {
			(async () => {
				const response = await fetch(environment.BACKEND_API_URL + '/api/watsonx/generate', {
					method: 'POST',
					headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream; charset=utf-8',
					'X-API-Key': environment.BACKEND_API_KEY
					},
					body: JSON.stringify(payload)
				});

				const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
				// To receive data as byte array we call getReader() directrly
				// const reader = response.body.getReader();
				while (true) {
					const {value, done} = await reader.read();
					if(value){
						observer.next(value);
					}
					if (done){
						observer.complete();
						return;
					}
				}
			})()
			.then(null, observer.error);
		});

	}

	// generateUsingOpenAI(payload: any, openai_api_key: string): Observable<any> {
	// 	console.log('IN LLMService.generateUsingOpenAI METHOD: >>>> ', payload);
    //     if(!this.httpHeaders){
    //         this.httpHeaders = this.refreshHeaders();
    //     }

	// 	let endpoint = environment.BACKEND_API_URL + '/api/openai/generate';
	// 	if(openai_api_key && openai_api_key.length > 10){
	// 		endpoint = endpoint + "?apikey="+openai_api_key
	// 	}

	// 	return this.http.post<any>(endpoint,
	// 		payload, { headers: this.httpHeaders });
	// }

	async generateUsingOpenAI(payload: any, openai_api_key: string) {
		return new Observable<any>((observer) => {
			(async () => {
				let endpoint = environment.BACKEND_API_URL + '/api/openai/generate';
				if(openai_api_key && openai_api_key.length > 10){
					endpoint = endpoint + "?apikey="+openai_api_key
				}
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
					'Content-Type': 'application/json',
					'Accept': 'text/event-stream; charset=utf-8',
					'X-API-Key': environment.BACKEND_API_KEY
					},
					body: JSON.stringify(payload)
				});

				const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
				// To receive data as byte array we call getReader() directrly
				// const reader = response.body.getReader();
				while (true) {
					const {value, done} = await reader.read();
					if(value){
						observer.next(value);
					}
					if (done){
						observer.complete();
						return;
					}
				}
			})()
			.then(null, observer.error);
		});

	}

	fetchEvaluationMetrics(payload: any): Observable<any> {
		console.log('IN LLMService.fetchEvaluationMetrics METHOD: >>>> ', payload);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/metrics/evaluate',
			payload, { headers: this.httpHeaders });
	}

	showSourceOnPage(sourceNode: any): Observable<any> {
		console.log('IN LLMService.showSourceOnPage METHOD, sourceNode >>>> ', sourceNode);
        if(!this.httpHeaders){
            this.httpHeaders = this.refreshHeaders();
        }
		return this.http.post<any>(environment.BACKEND_API_URL + '/api/rag/source',
			sourceNode, { headers: this.httpHeaders });
	}


}
