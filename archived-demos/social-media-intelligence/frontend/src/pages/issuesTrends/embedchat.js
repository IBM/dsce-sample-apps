function Embedchat(props){
  window.onpopstate = function(event) {
    // Reload the previous page
    window.history.go();
  };
  window.watsonAssistantChatOptions = {
    integrationID: process.env.REACT_APP_WATSON_ASSISTANT_INTEGRATION_ID, // The ID of this integration.
    region: process.env.REACT_APP_WATSON_ASSISTANT_REGION, // The region your integration is hosted in.
    serviceInstanceID: process.env.REACT_APP_WATSON_ASSISTANT_SERVICE_INSTANCE_ID, // The ID of your service instance.
    onLoad: async (instance) => { await instance.render(); }
  };
  setTimeout(function(){
    const t=document.createElement('script');
    t.src=process.env.REACT_APP_WATSON_ASSISTANT_T_SRC + (window.watsonAssistantChatOptions.clientVersion || 'latest') + "/WatsonAssistantChatEntry.js";
    document.head.appendChild(t);
  });
}
export default Embedchat;