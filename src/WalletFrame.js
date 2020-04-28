import { toBN } from "eth-sdk";
import { ethers } from "ethers";
const BN = require('bn.js');
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

// Convert all child props from BN to hex, non-recursive
const convertBNProps = (obj) => {
  obj = Object.assign({}, obj);
  const keys = Object.keys(obj);

  keys.forEach(k => {
    const v = obj[k];
    if(v && BN.isBN(v)) {
      obj[k] = '0x' + obj[k].toString(16);
    }
  });
  return obj;
}

let subIDHash = {};
const handleMsg = async (data, acct, refiFrame, sdk, _this) => {
  if (!refiFrame) throw new Error("no refiFrame");
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
      const rTransHash = await _this.provider.getTransaction(param0);
      console.log("eth_getTransactionByHash", rTransHash);
      result = rTransHash;
      break;
    case "eth_getBlockByHash":
    case "eth_getBlockByNumber":
      const getBlock = await _this.provider.getBlock(param0);
      console.log("eth_getBlockByNumber", getBlock);

      result = convertBNProps(getBlock);
      break;
      break;
    case "eth_getTransactionReceipt":
      const interval = setInterval(async () => {
        const r2 = await _this.provider.getTransactionReceipt(param0);

        if (r2) {
          if (r2.cumulativeGasUsed)
            r2.cumulativeGasUsed = "0x" + r2.cumulativeGasUsed.toString(16);
          if (r2.gasUsed) r2.gasUsed = "0x" + r2.gasUsed.toString(16);

          console.log("jd getTransactionReceipt polled");
          sendMessage(
            {
              ...response,
              result: r2,
            },
            refiFrame
          );
          clearInterval(interval);
        }
      }, 2200);
      return;
    case "eth_pendingTransactions":
      throw new Error("eth_pendingTransactions not supported");
      break;
    case "eth_unsubscribe":
      console.warn("eth_unsubscribe unsupported");
      break;
    case "eth_subscribe":
      console.warn("eth_subscribe stubbed");
      // pubsub: https://github.com/ethereum/go-ethereum/wiki/RPC-PUB-SUB
      if (param0 === "newHeads") {
        const resultId = "0x" + id.toString(16);

        if (subIDHash[id]) {
          console.warn("already subscribed: " + param0);
          return;
        }
        subIDHash[id] = params;

        // let highestBlock = '0x0';
        let blockCount = 0;
        // let startingBlock = 0;
        const f = async (b) => {
          // if(startingBlock===0) startingBlock = b;
          // highestBlock = await _this.provider.getBlockNumber();

          blockCount++;
          // console.warn('new block', b);
          let gb = await _this.provider.getBlock(b);
          gb = convertBNProps(gb);
          // wait until 3 block events
          // if(blockCount < 2) return;
          // const b2 = '0x' + b.toString(16);

          sendMessage(
            {
              method: "eth_subscription",
              params: {
                result: {
                  ...gb,
                },
                subscription: resultId,
              },
            },
            refiFrame
          );

          if (blockCount === 10) _this.provider.removeListener("block", f);
          // if(highestBlock===0) highestBlock = b;
          // highestBlock = b > highestBlock ? b : highestBlock;
        };
        _this.provider.on("block", f);

        result = resultId;
        break;
        // return;
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
      const rEthCall = await _this.provider.call(param0);
      result = rEthCall;
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
        value: toBN(param0.value), // .div(toBN("8")), // param0.value
        data: param0.data,
      };

      const optionsPretty = {
        ...options,
      };

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
          console.warn("jd RelayedTransactionUpdated", x);
          if (x.payload.state !== "Sending" && x.payload.state !== "Sent")
            return; // Sent
          //  && x.payload.hash
          if (!x.payload.hash) x.payload.hash = "0x0";
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
    jsonrpc: msg.jsonrpc || "2.0",
    ...msg,
  };
  console.log("responding", msgObj);

  const ref = refiFrame.contentWindow || refiFrame.contentDocument;
  if (!ref) {
    console.log("refiFrame.contentWindow", refiFrame.contentWindow);
    throw new Error("cannot access iFrame, check CORS");
  } else refiFrame.contentWindow.postMessage(msgObj, "*");
}

export default FrameProvider;
