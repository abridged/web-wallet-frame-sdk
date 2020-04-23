import { toBN } from "eth-sdk";
import { ethers } from 'ethers';
// https://api.infura.io/v1/jsonrpc/mainnet
export class FrameProvider {
  // pubkey - web wallet public key
  constructor(sdk, windowRef, pubkey) {
    if (!sdk) {
      throw new Error("no sdk provided");
    }
    this.sdk = sdk;
    this._window = windowRef;
    this.pubkey = pubkey;
    this.account = pubkey;
    this.provider = ethers.getDefaultProvider("homestead");
    // this.sdk.state$.notification$.subscribe();

    this._handleIframeTask = this.handleIframeTask.bind(this);
  }

  // prompt: ()=>(msg, approve, reject)
  setPrompt(prompt) {
    this.prompt = prompt;
  }

  async _doPrompt(msg) {
    let prompt = this.prompt;
    if (!prompt)
      prompt = function (msg, approve, reject) {
        var retVal = confirm("Do you want to continue? \nTransaction: " + msg);
        if (retVal) approve();
        else reject();
      };

    var p = new Promise((resolutionFunc) => {
      prompt(
        msg,
        () => {
          resolutionFunc(true);
        },
        () => {
          resolutionFunc(false);
        }
      );
    });

    return await p;
  }

  async destroy() {
    this.frameSrc = null; // flag as destroyed
    this._window.removeEventListener("message", this._handleIframeTask);
  }

  async setup(iframRef, frameSrc) {
    if (!this.pubkey && !this.account) throw new Error("provide pub address");
    if (!iframRef)
      throw new Error("frame reference is not set: setup(iframRef, frameSrc)");
    if (!frameSrc) throw new Error("no iFrame src");
    if (this.iframRef) {
      this.destroy();
    }

    this.frameSrc = frameSrc;
    this.iframRef = iframRef;

    const p = new Promise((x) => {
      const onLoad = () => {
        this.iframRef.removeEventListener("load", onLoad);

        if (!this.frameSrc) {
          throw new Error("setup failed, already destroyed"); // destroyed
        }
        this._window.addEventListener("message", this._handleIframeTask);
        x();
      };
      this.iframRef.addEventListener("load", onLoad);
    });
    this.iframRef.src = frameSrc;
    return p;
  }

  handleIframeTask(event) {
    if (!this.iframRef || !this.frameSrc) return;

    const data = event.data;

    // console.log("handleIframeTask state.account", this.account);

    if (data.jsonrpc) {
      handleMsg(data, this.account, this.iframRef, this.sdk, this); // state.account
    }
  }

  // Optional if needed to createAccount
  async createAccount(pubKey) {
    return await this.sdk.createAccount(pubKey).then((x) => {
      console.log(
        "x2 postcreateAccount",
        x.address,
        `x.deployed=${x.deployed}`
      );
      this.account = x.address;
      return x;
    });
  }
}

let subIDHash = {};
const handleMsg = async (data, acct, refiFrame, sdk, _this) => {
    if(!refiFrame) throw new Error('no refiFrame');
  // const provider = window.ethereum;
  const method = data.method;
  const params = data.params; // TODO
  const jsonrpc = data.jsonrpc;
  const id = data.id;
  // console.log("state", state);
  console.log("handleIframeTask", data);
  let response = {
    jsonrpc: jsonrpc,
    id: data.id,
    // ...data
  };

  const hasParams = params && params.length > 0;
  const param0 = hasParams ? params[0] : null;

  let options = {};
  let result = null;
  let r = null;
  switch (method) {
    case "request_funds":
    // TODO
    // CUSTOM ABI
    case "enable":
      // Metamask specific rpc
      result = [acct];
      break;
    case "eth_accounts":
      result = [acct];
      break;
    case "eth_getBalance":
      options = hasParams ? { address: params[0] } : {};
      const b = await sdk.getBalance(options);
      // console.log('getBalance', b);

      result = "0x" + b.toString(16);
      break;
    case "eth_sign":
      if (!hasParams) {
        throw new Error("eth_sign: no param provided");
      }
      // throw new Error('eth_sign not supported');
      const sig = await sdk.signMessage(params[0]);
      result = sig;
      break;
    case "personal_sign":
      // params[2] is pw
      // TODO: cleanup
      const msg = params[0] + (params[2] ? params[2] : "");
      const psig = await sdk.signMessage(msg);
      result = psig;
      break;
    case "eth_sendRawTransaction":
      throw new Error("eth_sendRawTransaction not supported");
      break;
    case "eth_getTransactionByHash":
        r = await _this.provider.getTransaction(param0);
        console.log('eth_getTransactionByHash', r);
        result = r;
        break;
    case "eth_getBlockByHash":
    case "eth_getBlockByNumber":
        r = await _this.provider.getBlock(param0);
        console.log('eth_getBlockByNumber', r);
        result = r;
        break;
        break;
    case "eth_getTransactionReceipt":
      r = await _this.provider.getTransactionReceipt(param0);
      console.log('eth_getTransactionReceipt', r, '-', param0);
      result = r;
      break;
      // TODO!
      // https://web3js.readthedocs.io/en/v1.2.1/web3-eth.html
      result = {
        status: "0x1",
        transactionHash: param0,
        blockNumber: 1,
        blockHash: 1, // MUST not be one
        transactionIndex: 1,
        gasUsed: 0,
      };
      // throw new Error('eth_getTransactionReceipt not supported');
      break;
    case "eth_pendingTransactions":
      throw new Error("eth_pendingTransactions not supported");
      break;
    case "eth_subscribe":
      console.warn("eth_subscribe stubbed");
      // pubsub: https://github.com/ethereum/go-ethereum/wiki/RPC-PUB-SUB
      if (param0 === "newHeads") {
        result = "0x" + id.toString(16);

        if (subIDHash[id]) {
          console.warn("already subscribed: " + param0);
          return;
        }
        subIDHash[id] = params;

        _this.provider.on('block', async b => {
            // console.warn('new block', b);
            const gb = await _this.provider.getBlock(b);
            sendMessage({
                  method: "eth_subscription",
                  params: {
                    result: {
                      highestBlock: 0,
                      currentBlock: b,
                      ...gb
                    },
                    subscription: result,
                  },
                }, refiFrame)
        });
        return;

        // subEvents[param0] = result;

        // HACK to make confirmation work
        setTimeout(() => {
          sendMessage(
            {
              method: "eth_subscription",
              params: {
                result: {
                  highestBlock: 0,
                  currentBlock: 203,
                },
                subscription: result,
              },
            },
            refiFrame
          );
        }, 2000);
      } else {
        throw new Error("unsupported eth_subscribe method: " + data);
      }
      break;
    case "net_version":
      // Ethereum Mainnet
      // TODO: support Kovan
      result = "1";
      break;
    case "eth_call":
        r = await _this.provider.call(param0);
        result = r;
        break;
    case "eth_sendTransaction":
      if (!hasParams) {
        throw new Error("eth_sendTransaction: params provided");
      }
      if (!param0.to) {
        throw new Error("eth_sendTransaction: no To address");
      }
      if (!param0.value && !param0.data) {
        throw new Error("eth_sendTransaction: no value or data to invoke");
      }

      // For debugging only
      if (false) {
        // for testing
        result = "0x0";
        if (true) break;
        return;
      }

      options = {
        recipient: param0.to,
        value: toBN(param0.value), // .div(toBN("8")), // param0.value), // param0.value
        data: param0.data,
      };

      const optionsPretty = {
        ...options,
        // value_as_eth: toBN(param0.value).div(toBN("1000000000000000000")).toString()
      };
      //

      const prettyMsg = JSON.stringify(optionsPretty, null, 2);
      const accepted = await _this._doPrompt(prettyMsg);
      if (!accepted) {
        console.warn("user cancelled");
        return;
      }

      // console.log("debug eth_sendTransaction:", param0, "--", options);
      await sdk.batchExecuteAccountTransaction(options);
      await sdk.estimateBatch();
      const responseKey = await sdk.submitBatch();

      // console.log("batch", batch);
      // console.log("responseKey", responseKey);

      const sub = sdk.state$.notification$.subscribe((x) => {
        if (!x || !x.payload) return;
        
        if (x.type !== "RelayedTransactionUpdated") return;
        if (x.payload.key === responseKey) {
            console.warn('jd RelayedTransactionUpdated', x);
            //  && x.payload.hash 
            if(!x.payload.hash) x.payload.hash = '0x0';
          console.warn("hash found!", x.payload);
          const trHash = x.payload.hash;
          response.result = trHash;
          sendMessage(response, refiFrame);

          // unsub
          sub.unsubscribe();
        }
      });

      //Returns DATA, 32 Bytes - the transaction hash, or the zero hash if the transaction is not yet available.
      // result = trHash; // "0x0";
      return;
    // break;
    case "eth_gasPrice":
      // To do: make accurate
      // result = "0x09184e72a000";
      result = await _this.provider.getGasPrice();
      result = result.toString();
      break;
    case "web3_clientVersion":
      result = "3frame/0.0.11";
    default:
      // console.warn("non implemented event:", method, data);
      throw new Error(method + " not supported");
    // result = "";
  }

  if (result !== null) {
    response.result = result;
  }

  sendMessage(response, refiFrame);
};

function sendMessage(msg, refiFrame) {
  if (!refiFrame) {
    throw new Error("null reference to refiFrame");
  }
  const msgObj = {
    jsonrpc: "2.0",
    ...msg,
  };
  console.log("responding", msg);

  const ref = refiFrame.contentWindow || refiFrame.contentDocument;
  if (!ref) {
    console.log("refiFrame.contentWindow", refiFrame.contentWindow);
    throw new Error("cannot access iFrame, check CORS");
  } else refiFrame.contentWindow.postMessage(msgObj, "*");
}

export default FrameProvider;
