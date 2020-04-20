
const CEL_SIZE = 6;

let PLAY_STATUS = 1;
let TO_INJECT = [];
let SHOW_GRID = true;

function updateState(state) {
    const newState = [];

    while (TO_INJECT.length) {
        let [x, y] = TO_INJECT.pop();
        state[x][y] = !state[x][y];
    }

    if (PLAY_STATUS === 0) {
        return state;
    }

    const [width, height] = [state[0].length, state.length];

    const coords = (x, y) => [
        x < 0 ? width -1 : x % width,
        y < 0 ? height - 1 : y % height,
    ];

    for (let x = 0; x < width; x++) {
        newState.push([]);
        for (let y = 0; y < height; y++) {
            newState[x].push(false);
            let sat =  [
                coords(x - 1, y - 1),
                coords(x - 1, y),
                coords(x - 1, y + 1),
                coords(x, y - 1),
                coords(x, y + 1),
                coords(x +  1, y - 1),
                coords(x + 1, y),
                coords(x + 1, y + 1),
            ];

            let vals = sat.map(([cx, cy]) => state[cx][cy]);

            let lives = vals.reduce((t, x) => t += x ? 1 : 0, 0);

            newState[x][y] = state[x][y]
                ? lives > 1 && lives < 4 
                : lives === 3
            ;
        }
    }

    return newState;
};

function render(context, state) {
    const gpx = (x) => x * CEL_SIZE +1;
    const line = (x, y, xx, yy) => {
        context.beginPath();
        context.strokeStyle="#ccc";
        context.lineWidth = 1;
        context.moveTo(x, y);
        context.lineTo(xx, yy);
        context.stroke();
    }
    const [width, height] = [state[0].length, state.length];

    context.clearRect(1,1,(width * CEL_SIZE)-2, (height * CEL_SIZE)) -2;

    if (SHOW_GRID) {
        let pxh = (height * CEL_SIZE) - 1;
        for (let y = 1; y < height; y++) {
            let pxy = y * CEL_SIZE;
            line(1, pxy, pxh, pxy);
        }
    }

    for (let x = 0; x < width; x++) {
        if (SHOW_GRID) {
            line((x+1) * CEL_SIZE, 1, (x+1) * CEL_SIZE, (width * CEL_SIZE) - 1);
        }
        for (let y = 0; y < height; y++) {
            if (state[x][y]) {
                let px = gpx(x);
                let py = gpx(y);
                context.beginPath();
                context.lineWidth = 1;
                context.fillStyle="white";
                context.fillRect(px, py, 4,  4);
                context.stroke();
            }
        }
    }
}

function tick(context, state) {
    const ts = Date.now();
    const newState = updateState(state);
    render(context, newState);

    window.requestAnimationFrame(() => {
        const lt = Date.now() - ts;
        const rt = 100 - lt;

        setTimeout(() => {
            tick(context, newState);
        }, rt);
    });
};

function start(canvas, width = 100, height = 100) {
    let state = new Array(100);

    for (let i = 0; i < width; i++) {
        state[i] = new Array(height);
        for (let j = 0; j < height; j++) {
            state[i][j] = false;
        }
    }

    state[10][10] = true;
    state[10][11] = true;
    state[10][12] = true;

    canvas.width = width * CEL_SIZE;
    canvas.height = height * CEL_SIZE;
    const context = canvas.getContext('2d');
    context.fillStyle = 'red';
    context.fillRect(0,0, canvas.width, canvas.height);

    canvas.addEventListener('click', (ev) => {
        let x = event.pageX - canvas.offsetLeft;
        let y = event.pageY - canvas.offsetTop;
        x = Math.ceil(x / CEL_SIZE) - 1;
        y = Math.ceil(y / CEL_SIZE) - 1;
        TO_INJECT.push([x, y]);
    });

    window.addEventListener('keyup', (ev) => {
        if (ev.keyCode == 32) {
            PLAY_STATUS = PLAY_STATUS === 1 ? 0 : 1;
        } else if (ev.keyCode == 77) {
            SHOW_GRID = !SHOW_GRID;
        } else if (ev.keyCode == 82) {
            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    if (Math.random() > 0.5) {
                        TO_INJECT.push([i, j]);
                    }
                }
            }
        }

        console.log('key', ev.keyCode);
    });

    tick(context, state);
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('screen');
    start(canvas);
});
