let _iframRef = null;
let _account = null;

export function connect(sdk, _window, iframRef, account) {
    _iframRef = iframRef;
    _account = account;
    _window.addEventListener("message", handleIframeTask);
}

const handleIframeTask = async event => {
    const data = event.data;

    console.log("handleIframeTask state.account", state.account);

    if (data.jsonrpc) {
      handleMsg(data, _account, _iframRef); // state.account
    }
  }

const handleMsg = async (data, acct, refiFrame) => {
    // const provider = window.ethereum;
  
    const method = data.method;
    const params = data.params;
    const jsonrpc = data.jsonrpc;
    // console.log("state", state);
    console.log("handleIframeTask", data);
    let response = {
      jsonrpc: jsonrpc,
      id: data.id
    };
    if (method === "enable") {
      // if (state.account)
      response.result = [acct];
      // response.result = [];
    } else if (method === "eth_accounts") {
      // if (state.account)
      response.result = { result: [acct] };
      // response.result = [];
    } else {
        console.warn('non implemented event:', data);
      // const c = await provider.send(method, params);
      // response.result = c.result;
    }
    const msg = {
      ...response,
      data: response
    };
    console.log("responding", msg);
    refiFrame.contentWindow.postMessage(msg, "*"); // TODO .current
  };