/* SystemJS module definition */
// declare var module: {
// 	id: string;
// };

declare var module: NodeModule;
interface NodeModule {
  id: string;
}

// declare var window: Window;
// interface Window {
//   process: any;
//   require: any;
// }

declare module '*html'
{
  const value:string;
  export default value
}

declare module "*.json" {
  const value: any;
  export default value;
}
