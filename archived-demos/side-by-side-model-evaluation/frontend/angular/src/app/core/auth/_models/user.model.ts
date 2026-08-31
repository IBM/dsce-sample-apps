import { BaseModel } from '../../_base/crud';

export class User extends BaseModel {
  id: string;
  tenantId: string;
  defaultAccountId: string;
  username: string;
  email: string;
  roles: string[];
  pic: string;
  firstName: string;
  lastName: string;
  accessType: string;
  emailVerified: string;


  clear(): void {
    this.id = undefined;
    this.defaultAccountId = undefined;
    this.tenantId = '';
    this.username = '';
    this.email = '';
    this.roles = [];
    this.firstName = '';
    this.lastName = '';
    this.pic = './assets/media/users/default.jpg';
    this.accessType = '';
    this.emailVerified = '';

  }
}
