export interface RecognizeStream {
  url?: string;
  file?: string;
  play?: boolean;
  realtime?: boolean;
  accessToken: string;
  format?: boolean;
  keepMicrophone?: boolean;
  outputElement?: string;
  extractResults?: boolean;
  objectMode?: boolean;
  resultsBySpeaker?: boolean;
  mediaStream?: MediaStream;
  model?:  string;
  language_customization_id?: string;
}
