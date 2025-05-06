import { BaseModel } from '../../_base/crud';

export class Account extends BaseModel {
  id: string;
  tenantId: string;
  providerId: string;
  name: string;
  title: string;
  type: string;  
  status: string;
  
  clear(): void {
    this.id = undefined;
    this.tenantId = '';
    this.name = '';
    this.type = '';
    this.providerId = '';
    this.title = '';
    this.status = '';   
  }
}
