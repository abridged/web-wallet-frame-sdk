# Abridged Web Wallet Frame Provider

This provider connects dapps into the Abridged web wallet sdk, by using a parent iFrame and a child dapp web3 polyfill.

`
npm install @abridged/web-wallet-frame-sdk
`

The parent iFrame should be constructed like:

```js
    import { FrameProvider } from "@abridged/web-wallet-frame-sdk";

    // SDK - Abridged SDK reference
    // window - browser window reference object
    // WALLET_PUB_KEY - user's web wallet public key
    
    let wallet = new FrameProvider(sdk, window, WALLET_PUB_KEY);

    // Set custom UI transaction prompt
    wallet.setPrompt( function(msg, approve, reject) {
        var retVal = confirm("Do you want to continue? Transaction: " + msg);
        // Approve transaction
        if(retVal) approve();
        // Reject transaction
        else reject();
    });

    // The setup function will change the iFrame object src to the target location and start listening for web3 calls from child.
    //
    // refiFrame - current iFrame reference to iFrame dom object
    // frameSrc - url for the IFrame to load once provider is loaded
    
    await wallet.setup(refiFrame, frameSrc);
```

The child iFrame should import the polyfill:

```js
import '@jadbox/iframe-provider-polyfill'
```

or add via html:
```html
<script src="https://cdn.jsdelivr.net/npm/@jadbox/iframe-provider-polyfill/dist/index.js" type="text/javascript"></script>
```
