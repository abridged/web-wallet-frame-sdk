# Abridged Web Wallet Frame Provider

`
npm install @abridged/web-wallet-frame-sdk
`

```js
    import { FrameProvider } from "@abridged/web-wallet-frame-sdk";

    let frameSrc = "https://MY_IFRAME_URL";

    // SDK - Abridged SDK reference
    // window - host window
    // WALLET_PUB_KEY - user's web wallet public key
    
    let wallet = new FrameProvider(sdk, window, WALLET_PUB_KEY);

    // setup: Will change the iFrame src to 'frameSrc' attribute above and start listening for web3 calls from child.
    //
    // refiFrame - current iFrame reference to iFrame dom object
    // frameSrc - url for the IFrame to load once provider is loaded
    
    await wallet.setup(refiFrame, frameSrc);
```