import { toBN } from 'eth-sdk';

export class FrameProvider {
    // pubkey - web wallet public key
    constructor(sdk, windowRef, pubkey) {
        if(!sdk) {
            throw new Error('no sdk provided');
        }
        this.sdk = sdk;
        this._window = windowRef;
        this.pubkey = pubkey;
        this.account = pubkey;

        this._handleIframeTask = this.handleIframeTask.bind(this);
    }

    // prompt: ()=>(msg, approve, reject)
    setPrompt(prompt) {
        this.prompt = prompt;
    }

    async _doPrompt(msg) {
        let prompt = this.prompt;
        if(!prompt) prompt = function(msg, approve, reject) {
            var retVal = confirm("Do you want to continue? Transaction: " + msg);
            if(retVal) approve();
            else reject();
        };

        var p = new Promise( (resolutionFunc, rejectionFunc) => {
            prompt(msg, resolutionFunc, rejectionFunc);
        });
    
        return await p;
    }

    async destroy() {
        this._window.addEventListener("message", this._handleIframeTask);
    }

    async setup(iframRef, frameSrc) {
        if (!this.pubkey && !this.account) throw new Error("provide pub address");
        if(!iframRef) throw new Error('frame reference is not set: setup(iframRef, frameSrc)');

        if(this.iframRef) {
            destroy();
        }

        this.frameSrc = frameSrc;
        this.iframRef = iframRef;

        this._window.addEventListener("message", this._handleIframeTask);

        const p = new Promise(x => {
            const onLoad = ()=>{
                this.iframRef.removeEventListener("load", onLoad);
                x();
            };
            this.iframRef.addEventListener("load", onLoad);
        });
        this.iframRef.src = frameSrc;
        return p;
    }

    stop() {
        this._window.removeEventListener("message", this._handleIframeTask);
    }

    handleIframeTask(event) {
        const data = event.data;

        // console.log("handleIframeTask state.account", this.account);

        if (data.jsonrpc) {
            handleMsg(data, this.account, this.iframRef, this.sdk); // state.account
        }
    }

    // Optional if needed to createAccount
    async createAccount(pubKey) {
        return await this.sdk.createAccount(pubKey).then(x => {
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

// export default FrameProvider;
let _i = 0;
const handleMsg = async(data, acct, refiFrame, sdk) => {
    // const provider = window.ethereum;
    const method = data.method;
    const params = data.params; // TODO
    const jsonrpc = data.jsonrpc;
    // console.log("state", state);
    console.log("handleIframeTask", data);
    let response = {
        jsonrpc: jsonrpc,
        id: data.id,
        // id: ++_i 
        // ...data
    };

    const hasParams = params && params.length > 0;
    const param1 = hasParams ? params[0] : null;

    let options = {};
    let result = null;
    switch(method) {
        case "enable":
            // Metamask specific rpc
            result = [acct];
            break;
        case "eth_accounts":
            result = [acct];
            break;
        case "eth_getBalance":
            options = hasParams ? {address: params[0]} : {};
            const b = await sdk.getBalance(options);
            // console.log('getBalance', b);

            result = '0x' + b.toString(16);
            break;
        case "eth_sign":
            if(!hasParams) {
                throw new Error('eth_sign: no param provided');
            }
            // throw new Error('eth_sign not supported');
            const sig = await sdk.signMessage(param1);
            result = sig;
            break;
        case "eth_sendRawTransaction":
            throw new Error('eth_sendRawTransaction not supported');
            break;
        case "eth_getTransactionReceipt":
            throw new Error('eth_getTransactionReceipt not supported');
            break;
        case "eth_pendingTransactions":
            throw new Error('eth_pendingTransactions not supported');
            break;
        case "eth_call":
        case "eth_sendTransaction":
            if(!hasParams) {
                throw new Error('eth_sendTransaction: params provided');
            }
            if(!param1.to) {
                throw new Error('eth_sendTransaction: no To address');
            }
            if(!param1.value && !param1.data) {
                throw new Error('eth_sendTransaction: no value or data to invoke');
            }
            options = {
                recipient: param1.to,
                value: toBN(param1.value),
                data: param1.data,
            };

            const prettyMsg = JSON.stringify(options, null, 2);
            try {
                await this._doPrompt(prettyMsg);
            } catch(e) {
                console.warn('user cancelled');
            }

            console.log('debug eth_sendTransaction:', options);
            await sdk.batchExecuteAccountTransaction(options);
            await sdk.estimateBatch();
            await sdk.submitBatch();

            //Returns DATA, 32 Bytes - the transaction hash, or the zero hash if the transaction is not yet available.
            result = '0x0';
            break;
        case "eth_gasPrice":
            // To do: make accurate
            result = "0x09184e72a000";
            break;
        case "web3_clientVersion":
            result = "3frame/0.0.11";
        default:
            console.warn("non implemented event:", method, data);
            result = "";
    }

    if(result!==null) {
        response.result = result;
    }

    const msg = {
        ...response,
        // data: response
    };
    console.log("responding", msg);
    
    if(!refiFrame.contentWindow) {
        console.log('refiFrame.contentWindow', refiFrame.contentWindow);
        throw new Error('cannot access iFrame, check CORS');
    }
    else refiFrame.contentWindow.postMessage(msg, "*"); // TODO .current
};

export default FrameProvider;