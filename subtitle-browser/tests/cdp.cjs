const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const endpoint = process.env.SUBTITLE_BROWSER_TEST_ENDPOINT || 'http://127.0.0.1:9226';
async function targets() { return (await fetch(endpoint + '/json/list')).json(); }
async function connect(target) {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = event => {
        const data = JSON.parse(event.data);
        const item = pending.get(data.id);
        if (!item) return;
        pending.delete(data.id); clearTimeout(item.timeout);
        data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result);
    };
    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const seq = ++id;
            const timeout = setTimeout(() => { pending.delete(seq); reject(new Error(method + ' timed out')); }, 7000);
            pending.set(seq, {resolve, reject, timeout});
            ws.send(JSON.stringify({id: seq, method, params}));
        });
    }
    async function evaluate(expression) {
        const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    async function click(selector, text) {
        const rect = await evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => !${JSON.stringify(text)} || el.textContent === ${JSON.stringify(text)}); if (!el) throw Error('Control not found'); const r = el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
        await send('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...rect});
        await send('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...rect});
    }
    return {send, evaluate, click, close: () => ws.close()};
}
async function waitFor(fn, label) {
    for (let i = 0; i < 60; i++) { const result = await fn(); if (result) return result; await sleep(100); }
    throw new Error(label + ' did not become ready');
}

module.exports = {targets,connect,waitFor,sleep};
