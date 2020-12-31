
const CEL_SIZE = 6;

let PLAY_STATUS = 1;
let TO_INJECT = [];
let SHOW_GRID = true;
let GEN_TIME = 110;
let SUPER_GRID_SIZE = 22;
let SHOW_SUPER_GRID = true;
let activeGrids = null;

let state;

const getId = (() => {
    let last = 0;
    return () => last++; 
})();

class Bitfield {

    constructor(size) {
        if (ArrayBuffer.isView(size)) {
            this._buffer = new Uint32Array(size.buffer);
        } else {
            this._buffer = new Uint32Array(Math.ceil(size / 32));
        }
    }

    clear() {
        this._buffer.fill(0x00);
    }

    get(x) {
        const word = this._buffer[(x / 32)|0];
        return !!(1 << (x % 32) & word);
    }

    getRaw(s, f) {
        let from = (s / 32)|0;
        let to = (f / 32)|0;
        let words = new Array(to - from);
        let res = new Bitfield(f - s);

        for (let i = from; i <= to; i++) {
            words[i](this._buffer[i]);
        }

        for (let i = 0; i < f - s ; i++) {
            const word = words[(i/32)|0];
            res.set(i, !!(1 << (x % 31) & word));
        }

        return res;
    }

    getRawSel(xs, xf, ys, yf) {
        
    }

    set(x, val = true) {
        const oval = this._buffer[(x / 32)|0];
        const vb = val ? 4294967295 : 0;
        if (val) {
            this._buffer[(x / 32)|0] = oval | (1 << (x % 32));
        } else {
            this._buffer[(x / 32)|0] = oval & ~(1 << (x % 32));
        }
    }

    clone(buffer) {
        return new Bitfield(buffer);
    }

    compare(d) {
        let res = true;
        for (let i = 0; i < this._buffer.length; i++) {
            if (this._buffer[i] !== d._buffer[i]) {
                res = false;
                break;
            }
        }

        return res;
    }

}

class Board {
    
    constructor(width, height, options = {}) {
        this._width = width;
        this._height = height;
        this._state = options.buffer || new Bitfield(width * height);
        this._backBoard = null;
        if (!options.buffer) {
            this._state.clear();
        }
    }

    get state() {
        return this._state;
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get backBoard() {
        if (!this._backBoard) {
            this._backBoard = new Board(this.width, this.height);
        }

        return this._backBoard;
    }

    get(x, y) {
        x = x < 0 ? this.width - 1 : x % this.width;
        y = y < 0 ? this.height - 1 : y % this.height;
        const idx = (x * this._width) + (y % this._height);
        return this._state.get(idx);
    }

    set(x, y, val = true) {
        x = x < 0 ? this.width - x - 1 : x % this.width;
        y = y < 0 ? this.height - y - 1 : y % this.height;
        const idx = (x * this._width) + (y % this._height);
        this._state.set(idx, val);
    }

    update(cb) {
        this.backBoard.clear();
        this._state = cb(this.backBoard).flip(this._state);
    }

    clear() {
        this._state.clear();
    }

    flip(nstate) {
        const astate = this._state;
        this._state = nstate;
        return astate;
    }

    map(cb) {
        map:
        for (let i = 0; i < this.width; i++) {
            for (let j = 0; j < this.height; j++) {
                if (cb(i, j, this.get(i, j)) === false) break map;
            }
        }
    }
}

class Game {

    constructor(elId, width = 100, height = 100, options = {}) {
        this._el = document.getElementById(elId);
        this._board = new Board(width, height);
        this._options = {
            celSize: 6,
            speed: 0,
            showGrid: false,
            debug: false,
            ...options,
        };
        this._state = 1;
        this._el.width = width * this._options.celSize;
        this._el.height = height * this._options.celSize;
    
        this.mingirds = [];
        this._times = {
            update: [],
            iupdate: [],
            mingrids: [],
        };

        this._generation = 0;
    }

    get board() {
        return this._board;
    }

    get generation() {
        return this._generation;
    }

    get context() {
        if (!this._options.context) {
            this._options.context = this._el.getContext('2d');
        }
        return this._options.context;
    }

    update(force = false) {
        if (!force && this._state !== 1) {
            return;
        }

        const uts = Date.now();

        this.board.update((newState) => {
            const ist = Date.now();
            const mingirds = [...this.mingirds];
            let itr = 0;
            this.mingirds = [];

            if (!mingirds.length) {
                mingirds.push([0, 0, this.board.width, 0, this.board.height, this.board.width, this.board.height]);
            }

            for (const [mgid, fw, tw, fh, th] of mingirds) {
                for (let x = fw; x <= tw; x++) {
                    for (let y = fh; y <= th; y++) {
                        itr++;
                        let state = this.board.get(x, y);

                        const lives = [
                            this.board.get(x - 1, y - 1),
                            this.board.get(x - 1, y),
                            this.board.get(x - 1, y + 1),
                            this.board.get(x, y - 1),
                            this.board.get(x, y + 1),
                            this.board.get(x +  1, y - 1),
                            this.board.get(x + 1, y),
                            this.board.get(x + 1, y + 1),
                        ]
                            .reduce((t, cel) => t += cel ? 1 : 0, 0);
                    
                        state = state ? lives > 1 && lives < 4 : lives === 3;

                        if (state) {
                            newState.set(x, y);
                            const sts = Date.now();
                            let mgxf = x - 1;
                            let mgxt = x + 1;
                            let mgyf = y - 1;
                            let mgyt = y + 1;

                            if (mgxf < 0 || mgxt > this.board.width) {
                                mgxf = 0;
                                mgxt = this.board.width;
                            }

                            if (mgyf < 0 || mgyt > this.board.height) {
                                mgyf = 0;
                                mgyt = this.board.height;
                            }

                            const mgxw = mgxt - mgxf;
                            const mgyw = mgyt - mgyf;
                            
                            const ags = this.mingirds
                                .filter(([t, mwf, mwt, mhf, mht, w, h]) =>
                                    mgxf <= mwf + w &&
                                    mgxf + mgxw >= mwf &&
                                    mgyf <= mhf + h &&
                                    mgyw + mgyf >= mhf
                                )
                            ;

                            if (ags.length) {
                                const agsids = ags.map(([x]) => x);
                                this.mingirds = this.mingirds.filter(([mid]) => !agsids.includes(mid));
                                const nmg = [...ags, [0, mgxf, mgxt, mgyf, mgyt]]
                                    .reduce(([aid, axf, axt, ayf, ayt], [cid, cxf, cxt, cyf, cyt]) => [
                                        aid,
                                        cxf < axf ? cxf : axf,
                                        cxt > axt ? cxt : axt,
                                        cyf < ayf ? cyf : ayf,
                                        cyt > ayt ? cyt : ayt,
                                        0,
                                        0,
                                    ], [getId(), this.board.width, 0, this.board.height, 0, 0, 0])
                                ;
                                nmg[5] = nmg[2] - nmg[1];
                                nmg[6] = nmg[4] - nmg[3];
                                this.mingirds.push(nmg);   
                            } else {
                                this.mingirds.push([
                                    getId(),
                                    mgxf,
                                    mgxt,
                                    mgyf,
                                    mgyt,
                                    mgxw,
                                    mgyw,
                                ]);
                            } // if

                            const now = Date.now();
                            this._times.mingrids.push([now, now - sts]);
                            if (this._times.mingrids.length > 100) {
                                this._times.mingrids.shift();
                            }
                        } // if
                    } // y
                }// x
            } // m

            this._times.iupdate.push([0, itr]);

            if (this._times.iupdate.length > 10) {
                this._times.iupdate.shift();
            }

            return newState;
        });

        this._generation++;
        const now = Date.now();
        this._times.update.push([now, now - uts]);

        if (this._times.update.length > 100) {
            this._times.update.shift();
        }
    }

    drawBoard() {
        this.context.strokeStyle = 'red';
        this.context.rect(
            0,
            0,
            this.board.width * this._options.celSize,
            this.board.height * this._options.celSize,
        );
        this.context.stroke();
    }

    drawMingrids() {
        for (const [id, fx, tx, fy, ty, w, h] of this.mingirds) {
            const {celSize} = this._options;
            const px = (fx * celSize) + 1;
            const py = (fy * celSize) + 1;
            const pw = (celSize * (w+1)) - 2;
            const ph = (celSize * (h+1)) - 2;
            this.context.fillStyle = 'green';
            this.context.fillRect(px, py, pw, ph);
        }
    }

    clearBoard() {
        const {width, height} = this.board;
        const {celSize} = this._options;

        this.context.clearRect(
            1,
            1,
            width * celSize - 2,
            height * celSize - 2,
        );

        if (this._options.showGrid) {
            this.context.beginPath();
            this.context.strokeStyle = '#555';

            for (let i = 1; i < width; i++) {
                this.context.moveTo(i * celSize,1);
                this.context.lineTo(i * celSize, (width * celSize) -1);
            }

            for (let i = 1; i < height; i++) {
                this.context.moveTo(1, i * celSize);
                this.context.lineTo((height * celSize) -1, i * celSize);
            }

            this.context.closePath();

        }

        this.context.stroke();
    }

    drawCel(x, y) {
        const {celSize} = this._options;
        const px = (x * celSize) + 1;
        const py = (y * celSize) + 1;
        const s = celSize - 2;
        this.context.fillStyle = 'white';
        this.context.fillRect(px, py, s, s);
    }

    render() {
        this.clearBoard();
        if (this._options.debug) {
            this.drawMingrids();
        }

        const mingirds = [...this.mingirds];

        if (!mingirds.length) {
            mingirds.push([0, 0, this.board.width, 0, this.board.height, this.board.width, this.board.height]);
        }

        for (const [mgid, fw, tw, fh, th] of mingirds) {
            for (let x = fw; x <= tw; x++) {
                for (let y = fh; y <= th; y++) {
                    if (this.board.get(x, y)) this.drawCel(x, y);
                }
            }
        };

        this.context.stroke();
    }

    asyncLoop() {
        const ts = Date.now();
        this.update();
        const tl = Date.now() - ts;
        setTimeout(() => {
            if (!this._state) return;
            this.asyncLoop();
        }, this._options.speed - tl);
    }

    renderLoop() {
        window.requestAnimationFrame(() => {
            this.render();
            this.renderLoop();
        });
    }

    start() {
        const px = (this.board.width / 2)|0;
        const py = (this.board.height / 2)|0;
        this.board.set(px, py - 1);
        this.board.set(px, py);
        this.board.set(px, py + 1);
        this.drawBoard();
        this.asyncLoop();
        this.renderLoop();
    }

    togglePause() {
        if (this._state === 1) {
            this._state = 2;
        } else {
            this._state = 1;
        }
    }

    toggleCel(x, y) {
        const val = this.board.get(x, y);
        this.board.set(x, y, !val);
        this.mingirds = [];
    }

    getTimes() {
        return Object.keys(this._times)
            .map((k) => [k, this._times[k]])
            .map(([k, times]) => [
                k,
                times.reduce((t, [, x]) => t += x, 0) / times.length,
            ])
        ;
    }
}

class GameControll {

    constructor(game) {
        this._game = game;
    }

    get game() {
        return this._game;
    }

    coordsToCel(x, y) {
        const {width, height} = this.game.board;
        const elWidth = this.game._el.offsetWidth;
        const elHeigth = this.game._el.offsetHeight;
        return [
            Math.floor(x / (elWidth / width)),
            Math.floor(y / (elHeigth / height)),
        ];
    }

    subscribeEvents() {

        this.game._el.addEventListener('click', (ev) => {
            let [x, y] = this.coordsToCel(
                event.pageX - this.game._el.offsetLeft,
                event.pageY - this.game._el.offsetTop
            );
            this.game.toggleCel(x, y);
        });

        window.addEventListener('keyup', (ev) => {
            console.log(ev.keyCode);
            if (ev.keyCode == 32) {
                this.game.togglePause();
            } else if (ev.keyCode == 77) {
                this.game._options.showGrid = !this.game._options.showGrid;
            } else if (ev.keyCode == 39) {
                this.game.update(true);
            } else if (ev.keyCode == 68) {
                this.game._options.debug = !this.game._options.debug;
            }
        });
    }

}

class GameStats {
    constructor(el, game) {
        this._el = document.getElementById(el);
        this._game = game;
        this._interval = null;
    }

    update() {
        const times = this._game.getTimes();
        const gen = this._game.generation;

        const ticks = times.find(([name]) => name === 'update');
        const iticks = times.find(([name]) => name === 'iupdate');
        const mgrids = times.find(([name]) => name === 'mingrids');

        this._el.querySelector('#gen').innerText = `${gen}`;
        this._el.querySelector('#ticks').innerText = `${ticks[1].toFixed(2)}`;
        this._el.querySelector('#iticks').innerText = `${iticks[1].toFixed(2)}`;
        this._el.querySelector('#mgrids').innerText = `${mgrids[1].toFixed(2)}`;
    }

    stopLoop() {
        clearInterval(this._interval);
    }

    startLoop() {
        this.stopLoop();
        this._interval = setInterval(() => {
            this.update();
        }, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game('screen', 150, 150);
    window.game.start();
    window.gameController = new GameControll(window.game);
    window.gameController.subscribeEvents();
    window.gamestats = new GameStats('lcd', window.game);
    window.gamestats.startLoop();
});


/*
function serialize(state) {
const [width, height] = [state.length, state[0].length];
const total = width * height;
const hex = (v) => (`0${v.toString(16)}`).substr(-2);
let result = [];

const coords = (x) => [
    x % width,
    (x / height)|0,
];

for (let i = 0; i < total; i++) {
    const [x, y] = coords(i);
    if (state[x][y]) {
        result.push([x,y]);
    }
}

return hex(width) + hex(height) + result.map(([x,y]) => hex(x) + hex(y)).join('');
}

function unserialize(serialized) {
const blocks = serialized
    .match(/.{2}/g)
    .map((x) => parseInt(x, 16));

const width = blocks.shift();
const height = blocks.shift();
const newState = new Array(width);

for (let i = 0; i < width; i++) {
    newState[i] = new Array(height);
    for (let j = 0; j < height; j++) {
        newState[i][j] = 0;
    }
}

for (let i = 0; i < blocks.length; i+=2) {
    newState[i][i+1] = true;
}

return newState;
}
*/
