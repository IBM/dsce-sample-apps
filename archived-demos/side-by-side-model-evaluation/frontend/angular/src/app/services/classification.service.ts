import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import * as tf from '@tensorflow/tfjs';
import * as useLoader from '@tensorflow-models/universal-sentence-encoder';
// import * as data from '../../assets/model/custom_nlc_tf2/word_index.json';

tf.ENV.set('WEBGL_PACK', false);
declare var Promise: any;

@Injectable({
  providedIn: 'root'
})
export class ClassificationService {

  private PAD_INDEX = 0;  // Index of the padding character.
  // private OOV_INDEX = 2;  // Index fo the OOV character.
  private use: any;
  private model: any;
  private MODEL_PATH = '../../assets/model/custom_nlc_tf2/model.json';
  private WORD_INDEX_PATH = '../../assets/model/word_index.json';
  private WORD_INDEX: any;

  private headers: HttpHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'text/html; charset=utf-8'
  });

    constructor(private http: HttpClient) {

     }

    async loadUSE() {
      if (this.use == null) {
        this.use = await useLoader.load();
        console.log('universal-sentence-encoder LOADED SUCCESSFULLY ..... ');
      }
      return this.use;
    }

    async loadModel(): Promise<any> {
      if (this.model == null) {
        this.model = await tf.loadLayersModel(this.MODEL_PATH);
        console.log('Tensorflow MODEL LOADED SUCCESSFULLY ..... ');
      }
      return this.model;
    }

    async getTokenisedWord(seedWords) {
      if (!this.WORD_INDEX) {
        const data = await this.http.get(this.WORD_INDEX_PATH, {responseType: 'json'})
          .toPromise()
          .then(res => {
            return res;
          })
          .catch(this.handleErrorPromise);
        // console.log('WORD_INDEX Data: >>> ', data);
        // this.WORD_INDEX  = (data  as  any).default;
        this.WORD_INDEX = data;
      }
      const tokenizedArr: number[] = [];
      for (let i = 0; i < seedWords.length; i++) {
        const _token = this.WORD_INDEX[seedWords[i].toLowerCase()];
        if (_token === undefined) {
          tokenizedArr.push(1);
        }else {
          tokenizedArr.push(_token);
        }
      }
      return tokenizedArr
    }

    async tokenizeSentence(inputText) {
      // console.log('In tokenizeSentence, inputText: >> ', inputText);
      inputText = inputText.split(/\b/).map(t => t.trim().toLowerCase().replace(/(\.|\,|\!|\-)/g, '')).filter(t => t.length !== 0);
      // inputText = inputText.split(/\b/).map(t => t.trim().toLowerCase().replace(^0-9a-z #+_)/g, '')).filter(t => t.length !== 0);

      return inputText;
      // return await useLoader.loadTokenizer().then(tokenizer => {
      //   inputText =  tokenizer.encode(inputText);
      // });
    }

    async padSequences(sequences, maxLen, padding = 'pre', truncating = 'pre', value = this.PAD_INDEX) {
        return sequences.map(seq => {
          // Perform truncation.
          if (seq.length > maxLen) {
            if (truncating === 'pre') {
              seq.splice(0, seq.length - maxLen);
            } else {
              seq.splice(maxLen, seq.length - maxLen);
            }
          }

          // Perform padding.
          if (seq.length < maxLen) {
            const pad = [];
            for (let i = 0; i < maxLen - seq.length; ++i) {
              pad.push(value);
            }
            if (padding === 'pre') {
              seq = seq.concat(pad);
            } else {
              seq = pad.concat(seq);
            }
          }

          return seq;
        });
    }

    async predictSkill(inputText): Promise<any> {
      if (!inputText || inputText === '' || !this.model) {
        return Promise.resolve('None');
      }
      // const [use, model] = await Promise.all([this.loadUSE(), this.loadModel()]);
      // const [model] = await Promise.all([this.loadModel()]);
      const sentence = await this.tokenizeSentence(inputText);
      console.log('Tokenized Sentence: ', sentence);
      const seedWordToken: any = await this.getTokenisedWord(sentence);
      // console.log('seedWordToken.length: >> >', seedWordToken.length);
      console.log('seedWordToken: >> >', seedWordToken);
      let undefinedCount = 0;
      for (const token of seedWordToken) {
          if (token === 1) {
            undefinedCount = undefinedCount + 1;
          }
      }
      // console.log('undefinedCount: >> ', undefinedCount);
      if (undefinedCount > 15) {
        return 'UNKNOWN'
      }
      // const activations = await use.embed([sentence]);
      // console.log('activations: >>> ', activations);
      const paddedSequences = await this.padSequences([seedWordToken], 200);
      console.log('paddedSequences: >> ', paddedSequences);
      // let tensor = tf.tensor(inputText);
      // tensor = tensor.expandDims(0);
      // tf.tidy(() => {
      const input = tf.tensor2d(paddedSequences, [1, 200]);
       return this.model.predict(input).data().then(predictions => {
		  console.log('predictions: >> ', predictions);
          const maxIndex = tf.argMax(predictions).dataSync()[0]
          // const labels = ['Common', 'Covid19', 'HomeAutomation']
          const labels = [
            'COMMON',
            '0bb0ace2-e073-4a74-bf81-813148b3cbf9',
            'fd0ac5f5-d10c-4214-8673-b0777cce5dbf',
			'Abbott'
          ];
          const result = {
            'assistantId': labels[maxIndex],
            'confidence': predictions[maxIndex]
          };
          return result;
          // return {'maxIndex': maxIndex, 'predictions': predictions};
          // predictions.dispose();
        }).catch(this.handleErrorPromise);
      // });
    }

   async predictLanguage(payload): Promise<any> {
      if (!payload || !payload.message || payload.message === '') {
        return Promise.resolve('None');
      }
      console.log('IN predictLanguage, payload: >>>', payload);
      const POST_URL = '//lang-detect.mybluemix.net/detect';
      if (!payload || !payload.message || payload.message.trim() === '') {
          return Promise.reject('INVALID DATA');
      } else {
          return this.http.post(POST_URL, payload, {responseType: 'text'})
          .toPromise()
          .then(res => {
            console.log('response: >> ', res);
            return res;
          })
          .catch(this.handleErrorPromise);
      }
    }

    private extractData(res: Response) {
      console.log('response: >> ', res);
      // let body = res.json();
      return res;
    }

    private handleErrorPromise (error: Response | any) {
      console.error(error || error.message);
      return Promise.reject(error || error.message);
    }

    /*
    async predictSkill2(inputText): Promise<any> {
      const [use, model] = await Promise.all([this.loadUSE(), this.loadModel()]);
      const sentence = await this.tokenizeSentence(inputText);
      model.embed([sentence])
        .then(embeddings => {
          tf.tidy(() => {
            const input = tf.tensor2d(embeddings, [1, 200]);
            model.predict(input).data().then(predictions => {
              console.log(predictions);
              const resultIdx = tf.argMax(predictions).dataSync()[0];
              console.log('resultIdx: >>> ', resultIdx);
              const labels = ['sport', 'bussiness', 'politics', 'tech', 'entertainment']
              console.log('Prediction ::', labels[resultIdx - 1]);
              // predictions.dispose();
            });
          });
        }).catch(err => console.error('Fit Error:', err));
    }
    */


}
