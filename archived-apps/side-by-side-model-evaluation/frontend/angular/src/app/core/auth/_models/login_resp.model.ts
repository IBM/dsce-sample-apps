import { User } from '..';
import { BaseModel } from '../../_base/crud';

export class LoginResponse extends BaseModel {
  user: User;
  token: string;
  refreshToken: string;
  
  clear(): void {
    this.user = undefined;
    this.token = undefined;
    this.refreshToken = undefined;

  }
}
