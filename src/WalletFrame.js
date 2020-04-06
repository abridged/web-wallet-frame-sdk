export class FrameProvider {
    // pubkey - web wallet public key
    constructor(sdk, windowRef, pubkey) {
        this.sdk = sdk;
        this._window = windowRef;
        this.pubkey = pubkey;
        this.account = pubkey;
    }

    async setup(iframRef, frameSrc) {
        if (!this.pubkey && !this.account) throw new Error("provide pub address");

        this.frameSrc = frameSrc;
        this.iframRef = iframRef;

        this._window.addEventListener("message", this.handleIframeTask);

        this.iframRef.src = frameSrc;
        return this.account;
    }

    stop() {
        this._window.removeEventListener("message", this.handleIframeTask);
    }

    handleIframeTask = event => {
        const data = event.data;

        console.log("handleIframeTask state.account", this.account);

        if (data.jsonrpc) {
            handleMsg(data, this.account, this.iframRef); // state.account
        }
    };

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

const handleMsg = async(data, acct, refiFrame) => {
    // const provider = window.ethereum;

    const method = data.method;
    // const params = data.params; // TODO
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
        console.warn("non implemented event:", data);
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