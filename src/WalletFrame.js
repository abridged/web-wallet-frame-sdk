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
            console.log('getBalance', b);

            // FOR TESTING
            result = '0x' + b.toString(16); // b; //BN to wai?
            break;
        case "eth_sendTransaction":
            if(!hasParams) break;
            options = {
                recipient: param1.to,
                value: toBN(param1.value),
                data: param1.data,
            }; 
            await sdk.batchExecuteAccountTransaction(options);
            await sdk.estimateBatch();
            await sdk.submitBatch();
            result = [];
            break;
        case "eth_gasPrice":
            result = "0x0";
            break;
        case "web3_clientVersion":
            result = "3frame/0.0.11";
        default:
            console.warn("non implemented event:", data);
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