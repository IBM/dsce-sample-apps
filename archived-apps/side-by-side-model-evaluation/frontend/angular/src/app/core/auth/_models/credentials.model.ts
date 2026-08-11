import { BaseModel } from '../../_base/crud';

export class Credentials extends BaseModel {
  
  username: string;
  password: string;
  returnUrl: string;
  
  clear(): void {
    this.username = undefined;
    this.password = '';
    this.returnUrl = '';
  }
}
