export enum RESOURCE {
    DEVICE = 'DEVICE',
    RULE = 'RULE'
  }
  
  export enum OPERATION {
    NONE = 'NONE',
    CREATE = 'CREATE',
    READ = 'READ',
    DELETE = 'DELETE'
  }
  
  export class Permission {
    resource: string;
    operation: string;
    realmRoles: Array<string>;
    clientRoles: Array<string>;
    groups: Array<string>;
    accountType: string;
  }